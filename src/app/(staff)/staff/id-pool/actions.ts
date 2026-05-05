"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function extractCodesFromRows(rows: unknown[]) {
  return rows
    .map((row) => {
      if (typeof row === "string") {
        return row.trim();
      }

      if (row && typeof row === "object") {
        const maybeCode =
          (row as Record<string, unknown>).staffing_code ??
          (row as Record<string, unknown>).staffingCode ??
          (row as Record<string, unknown>).id ??
          Object.values(row as Record<string, unknown>)[0];

        return String(maybeCode ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

export async function uploadStaffingIdsAction(formData: FormData) {
  await requireStaffUser();

  const file = formData.get("ids-file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Select a CSV or Excel file before uploading.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const staffingCodes = [...new Set(extractCodesFromRows(rows))];

  if (staffingCodes.length === 0) {
    throw new Error("No valid IDs were found in the uploaded file.");
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("staffing_id_pool").upsert(
    staffingCodes.map((staffingCode) => ({
      staffing_code: staffingCode,
      source_file_name: file.name
    })),
    {
      onConflict: "staffing_code",
      ignoreDuplicates: true
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const { data: temporaryProfiles, error: temporaryProfilesError } = await admin
    .from("profiles")
    .select("id, created_at")
    .eq("role", "mch")
    .eq("has_temporary_staffing_code", true)
    .order("created_at");

  if (temporaryProfilesError) {
    throw new Error(temporaryProfilesError.message);
  }

  const { data: availablePoolRows, error: availablePoolError } = await admin
    .from("staffing_id_pool")
    .select("id, staffing_code")
    .eq("is_assigned", false)
    .order("staffing_code");

  if (availablePoolError) {
    throw new Error(availablePoolError.message);
  }

  const temporaryProfileIds = (temporaryProfiles ?? []).map((profile) => profile.id);
  let profilesToPromote: Array<{ id: string; created_at?: string | null }> = [];

  if (temporaryProfileIds.length > 0) {
    const { data: visitsWithProfiles, error: visitsWithProfilesError } = await admin
      .from("visits")
      .select("mch_profile_id")
      .in("mch_profile_id", temporaryProfileIds);

    if (visitsWithProfilesError) {
      throw new Error(visitsWithProfilesError.message);
    }

    const eligibleProfileIds = new Set(
      (visitsWithProfiles ?? []).map((visit) => visit.mch_profile_id)
    );

    profilesToPromote = (temporaryProfiles ?? []).filter((profile) =>
      eligibleProfileIds.has(profile.id)
    );
  }

  const poolRowsToAssign = availablePoolRows ?? [];
  const promotions = Math.min(profilesToPromote.length, poolRowsToAssign.length);

  for (let index = 0; index < promotions; index += 1) {
    const profile = profilesToPromote[index];
    const poolRow = poolRowsToAssign[index];

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        staffing_code: poolRow.staffing_code,
        has_temporary_staffing_code: false
      })
      .eq("id", profile.id);

    if (profileUpdateError) {
      throw new Error(profileUpdateError.message);
    }

    const { error: poolUpdateError } = await admin
      .from("staffing_id_pool")
      .update({
        is_assigned: true,
        assigned_profile_id: profile.id
      })
      .eq("id", poolRow.id);

    if (poolUpdateError) {
      throw new Error(poolUpdateError.message);
    }
  }

  revalidatePath("/staff/id-pool");
  revalidatePath("/staff/users");
}
