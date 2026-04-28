"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildFullName } from "@/lib/utils";
import { mchRegistrationSchema } from "@/lib/validation";

type LoginState = {
  error: string | null;
};

type RegisterState = {
  error: string | null;
  success: string | null;
};

async function getNextTemporaryStaffingCode() {
  const admin = createAdminSupabaseClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("staffing_code")
    .eq("role", "mch");

  if (error) {
    throw new Error("We could not generate a temporary ID.");
  }

  const usedNumericCodes = (profiles ?? [])
    .map((profile) => Number.parseInt(String(profile.staffing_code ?? ""), 10))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);

  let nextCode = 1;

  for (const code of usedNumericCodes) {
    if (code === nextCode) {
      nextCode += 1;
      continue;
    }

    if (code > nextCode) {
      break;
    }
  }

  return String(nextCode);
}

export async function signInMchAction(_: LoginState, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  const admin = createAdminSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "We could not validate your session." };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "No profile is linked to this account." };
  }

  if (profile.role === "staff") {
    redirect("/staff/audit");
  }

  redirect("/mch/visits");
}

export async function signInStaffAction(_: LoginState, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  const admin = createAdminSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "We could not validate your session." };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "No profile is linked to this account." };
  }

  if (profile.role !== "staff") {
    return { error: "This area is only available to staff users." };
  }

  redirect("/staff/audit");
}

export async function registerMchAction(
  _: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  try {
    const parsed = mchRegistrationSchema.parse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phoneNumber: formData.get("phoneNumber"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword")
    });

    const supabase = await createServerSupabaseClient();
    const admin = createAdminSupabaseClient();
    const fullName = buildFullName(parsed.firstName, parsed.lastName);

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", parsed.email)
      .maybeSingle();

    if (existingProfile) {
      return {
        error: "An account with this email already exists.",
        success: null
      };
    }

    const { data: availableId, error: availableIdError } = await admin
      .from("staffing_id_pool")
      .select("id, staffing_code")
      .eq("is_assigned", false)
      .order("staffing_code")
      .limit(1)
      .maybeSingle();

    if (availableIdError) {
      return {
        error: "We could not get an available ID for this account. Please try again.",
        success: null
      };
    }

    const assignedStaffingCode = availableId?.staffing_code ?? (await getNextTemporaryStaffingCode());
    const usesTemporaryStaffingCode = !availableId;

    const { data: authResult, error: authError } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: {
        role: "mch",
        staffing_code: assignedStaffingCode,
        full_name: fullName
      }
    });

    if (authError || !authResult.user) {
      return {
        error:
          authError?.message?.toLowerCase().includes("already")
            ? "An account with this email already exists."
            : authError?.message ?? "We could not create your account.",
        success: null
      };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authResult.user.id,
      role: "mch",
      staffing_code: assignedStaffingCode,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      phone_number: parsed.phoneNumber,
      email: parsed.email,
      has_temporary_staffing_code: usesTemporaryStaffingCode,
      must_reset_password: false,
      created_by: null
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(authResult.user.id);

      return {
        error: `We created the auth account, but could not finish your profile setup: ${profileError.message}`,
        success: null
      };
    }

    if (availableId) {
      const { data: assignedRows, error: assignError } = await admin
        .from("staffing_id_pool")
        .update({
          is_assigned: true,
          assigned_profile_id: authResult.user.id
        })
        .eq("id", availableId.id)
        .eq("is_assigned", false)
        .select("id");

      if (assignError || !assignedRows || assignedRows.length === 0) {
        await admin.from("profiles").delete().eq("id", authResult.user.id);
        await admin.auth.admin.deleteUser(authResult.user.id);

        return {
          error: "We could not reserve an ID for this account. Please try again.",
          success: null
        };
      }
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password
    });

    if (signInError) {
      return {
        error: null,
        success: "Your account was created. You can now sign in with your email and password."
      };
    }

    redirect("/mch/visits");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];

      return {
        error:
          firstIssue?.path[0] === "confirmPassword"
            ? "Passwords must match."
            : firstIssue?.path[0] === "password"
              ? "Password must be at least 8 characters."
            : firstIssue
              ? `Check the ${String(firstIssue.path[0])} field: ${firstIssue.message}`
              : "Check your information and try again.",
        success: null
      };
    }

    return {
      error: error instanceof Error ? error.message : "We could not create your account.",
      success: null
    };
  }
}
