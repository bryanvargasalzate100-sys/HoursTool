"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildInitialMchPassword } from "@/lib/domain/passwords";
import { buildFullName } from "@/lib/utils";
import { mchUserSchema } from "@/lib/validation";

type StaffUserFormState = {
  error: string | null;
  success: string | null;
  generatedPassword: string | null;
};

export async function createMchUserAction(
  _: StaffUserFormState,
  formData: FormData
): Promise<StaffUserFormState> {
  try {
    const staffProfile = await requireStaffUser();

    const parsed = mchUserSchema.parse({
      staffingCode: formData.get("staffingCode"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phoneNumber: formData.get("phoneNumber"),
      email: formData.get("email"),
      storeId: formData.get("storeId"),
      agencyId: formData.get("agencyId"),
      hourlyRate: formData.get("hourlyRate")
    });

    const admin = createAdminSupabaseClient();
    const password = buildInitialMchPassword(parsed);
    const fullName = buildFullName(parsed.firstName, parsed.lastName);

    const { data: idPoolItem, error: idLookupError } = await admin
      .from("staffing_id_pool")
      .select("id, is_assigned")
      .eq("staffing_code", parsed.staffingCode)
      .single();

    if (idLookupError || !idPoolItem) {
      return {
        error: "The selected ID is not available in the code pool.",
        success: null,
        generatedPassword: null
      };
    }

    if (idPoolItem.is_assigned) {
      return {
        error: "That ID has already been used.",
        success: null,
        generatedPassword: null
      };
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: parsed.email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "mch",
        staffing_code: parsed.staffingCode,
        full_name: fullName
      }
    });

    if (authError || !authUser.user) {
      return {
        error: authError?.message ?? "Could not create the user in Auth.",
        success: null,
        generatedPassword: null
      };
    }

    const profilePayload = {
      id: authUser.user.id,
      role: "mch",
      staffing_code: parsed.staffingCode,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      phone_number: parsed.phoneNumber,
      email: parsed.email,
      agency_id: parsed.agencyId,
      default_store_id: parsed.storeId,
      hourly_rate: parsed.hourlyRate,
      created_by: staffProfile.id
    };

    const { error: profileError } = await admin.from("profiles").insert(profilePayload);

    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return {
        error: profileError.message,
        success: null,
        generatedPassword: null
      };
    }

    const { error: assignError } = await admin
      .from("staffing_id_pool")
      .update({
        is_assigned: true,
        assigned_profile_id: authUser.user.id
      })
      .eq("id", idPoolItem.id);

    if (assignError) {
      await admin.from("profiles").delete().eq("id", authUser.user.id);
      await admin.auth.admin.deleteUser(authUser.user.id);
      return {
        error: assignError.message,
        success: null,
        generatedPassword: null
      };
    }

    revalidatePath("/staff/users");
    revalidatePath("/staff/id-pool");

    return {
      error: null,
      success: "MCH user created successfully.",
      generatedPassword: password
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];

      return {
        error: firstIssue
          ? `Check the ${firstIssue.path[0]} field: ${firstIssue.message}`
          : "Check the form details and try again.",
        success: null,
        generatedPassword: null
      };
    }

    return {
      error: error instanceof Error ? error.message : "Could not create the user.",
      success: null,
      generatedPassword: null
    };
  }
}
