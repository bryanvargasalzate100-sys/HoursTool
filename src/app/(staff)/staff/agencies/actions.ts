"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeNamePart } from "@/lib/utils";
import { agencySchema } from "@/lib/validation";

type AgencyFormState = {
  error: string | null;
  success: string | null;
};

const initialState: AgencyFormState = {
  error: null,
  success: null
};

function buildLegacyAgencyCode(name: string) {
  const normalized = normalizeNamePart(name).toUpperCase();
  return (normalized || "AGENCY").slice(0, 24);
}

export async function createAgencyAction(
  _: AgencyFormState = initialState,
  formData: FormData
): Promise<AgencyFormState> {
  try {
    await requireStaffUser();

    const parsed = agencySchema.parse({
      name: formData.get("name"),
      charge: formData.get("charge")
    });

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("agencies").insert({
      name: parsed.name,
      charge: parsed.charge,
      code: buildLegacyAgencyCode(parsed.name)
    });

    if (error) {
      return {
        error:
          error.code === "23505"
            ? "An agency with this name already exists."
            : "We could not save this agency. Please try again.",
        success: null
      };
    }

    revalidatePath("/staff/agencies");
    revalidatePath("/staff/users");

    return {
      error: null,
      success: "Agency saved successfully."
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return {
        error: firstIssue
          ? `Check the ${firstIssue.path[0]} field: ${firstIssue.message}`
          : "Check the form details and try again.",
        success: null
      };
    }

    return {
      error: error instanceof Error ? error.message : "We could not save this agency.",
      success: null
    };
  }
}

export async function updateAgencyAction(
  _: AgencyFormState = initialState,
  formData: FormData
): Promise<AgencyFormState> {
  try {
    await requireStaffUser();

    const agencyId = String(formData.get("agencyId") ?? "").trim();

    if (!agencyId) {
      return {
        error: "Agency id is required.",
        success: null
      };
    }

    const parsed = agencySchema.parse({
      name: formData.get("name"),
      charge: formData.get("charge")
    });

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("agencies")
      .update({
        name: parsed.name,
        charge: parsed.charge,
        code: buildLegacyAgencyCode(parsed.name)
      })
      .eq("id", agencyId);

    if (error) {
      return {
        error:
          error.code === "23505"
            ? "An agency with this name already exists."
            : "We could not update this agency. Please try again.",
        success: null
      };
    }

    revalidatePath("/staff/agencies");
    revalidatePath("/staff/users");

    return {
      error: null,
      success: "Agency updated."
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return {
        error: firstIssue
          ? `Check the ${firstIssue.path[0]} field: ${firstIssue.message}`
          : "Check the form details and try again.",
        success: null
      };
    }

    return {
      error: error instanceof Error ? error.message : "We could not update this agency.",
      success: null
    };
  }
}
