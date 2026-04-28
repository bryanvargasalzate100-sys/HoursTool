"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditDayReviewSchema } from "@/lib/validation";

type ReviewDayState = {
  error: string | null;
  success: string | null;
};

function buildLocalDateTime(date: string, time: string) {
  return `${date}T${time}`;
}

function localDateTimeToUtcIso(value: string, timezoneOffsetMinutes: number) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) + timezoneOffsetMinutes * 60_000;

  return new Date(utcMs).toISOString();
}

const payloadSchema = z.array(
  z.object({
    id: z.string().uuid(),
    checkInAt: z.string(),
    checkOutAt: z.string(),
    notes: z.string().nullable().optional()
  })
);

export async function reviewVisitDayAction(
  _: ReviewDayState,
  formData: FormData
): Promise<ReviewDayState> {
  const staffProfile = await requireStaffUser({ onFail: "null" });

  if (!staffProfile) {
    return {
      error: "Your session expired. Please sign in again.",
      success: null
    };
  }

  const intent = String(formData.get("intent") ?? "save").trim().toLowerCase();

  if (intent !== "save" && intent !== "approve" && intent !== "reject") {
    return {
      error: "We could not understand this review action.",
      success: null
    };
  }

  try {
    const rawPayload = String(formData.get("payload") ?? "[]");
    const parsedPayload = payloadSchema.parse(JSON.parse(rawPayload));
    const parsed = auditDayReviewSchema.parse({
      mchProfileId: formData.get("mchProfileId"),
      visitDate: formData.get("visitDate"),
      timezoneOffsetMinutes: formData.get("timezoneOffsetMinutes"),
      visits: parsedPayload,
      rejectionReason: formData.get("rejectionReason")
    });

    if (Number.isNaN(parsed.timezoneOffsetMinutes)) {
      return {
        error: "We could not determine your local time zone. Reload and try again.",
        success: null
      };
    }

    const normalizedVisits = parsed.visits
      .map((visit) => ({
        ...visit,
        notes: visit.notes?.trim() ? visit.notes.trim() : null,
        checkInAtIso: localDateTimeToUtcIso(
          buildLocalDateTime(parsed.visitDate, visit.checkInAt),
          parsed.timezoneOffsetMinutes
        ),
        checkOutAtIso: localDateTimeToUtcIso(
          buildLocalDateTime(parsed.visitDate, visit.checkOutAt),
          parsed.timezoneOffsetMinutes
        )
      }))
      .sort((left, right) => left.checkInAtIso.localeCompare(right.checkInAtIso));

    for (let index = 1; index < normalizedVisits.length; index += 1) {
      const previous = normalizedVisits[index - 1];
      const current = normalizedVisits[index];

      if (previous.checkOutAtIso > current.checkInAtIso) {
        return {
          error: "One or more visits overlap after your edits. Adjust the hours and try again.",
          success: null
        };
      }
    }

    const admin = createAdminSupabaseClient();
    const visitIds = normalizedVisits.map((visit) => visit.id);
    const { data: existingVisits, error: existingVisitsError } = await admin
      .from("visits")
      .select("id, store_id")
      .eq("mch_profile_id", parsed.mchProfileId)
      .eq("visit_date", parsed.visitDate)
      .in("id", visitIds);

    if (existingVisitsError || !existingVisits || existingVisits.length !== visitIds.length) {
      return {
        error: "We could not load the selected visits for review.",
        success: null
      };
    }

    const existingVisitsMap = new Map(
      existingVisits.map((visit) => [visit.id, visit])
    );

    if (normalizedVisits.some((visit) => !existingVisitsMap.get(visit.id)?.store_id)) {
      return {
        error: "We could not recover the original store for one or more visits.",
        success: null
      };
    }

    const reviewedAt = new Date().toISOString();
    const updates = normalizedVisits.map((visit) => ({
      id: visit.id,
      mch_profile_id: parsed.mchProfileId,
      store_id: existingVisitsMap.get(visit.id)?.store_id,
      visit_date: parsed.visitDate,
      check_in_at: visit.checkInAtIso,
      check_out_at: visit.checkOutAtIso,
      notes: visit.notes,
      status: intent === "approve" ? "approved" : intent === "reject" ? "rejected" : "pending",
      reviewed_by: staffProfile.id,
      reviewed_at: reviewedAt,
      approved_by: intent === "approve" ? staffProfile.id : null,
      approved_at: intent === "approve" ? reviewedAt : null,
      rejection_reason: intent === "reject" ? parsed.rejectionReason?.trim() || null : null
    }));

    const { error: updateError } = await admin.from("visits").upsert(updates, {
      onConflict: "id"
    });

    if (updateError) {
      return {
        error: "We could not save the reviewed hours. Please try again.",
        success: null
      };
    }

    revalidatePath("/staff/audit");
    revalidatePath("/mch/visits");

    return {
      error: null,
      success:
        intent === "approve"
          ? "Day approved successfully."
          : intent === "reject"
            ? "Day rejected successfully."
          : "Changes saved. This day stays pending until you approve it."
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        error: "We could not read the visit review payload.",
        success: null
      };
    }

    if (error instanceof ZodError) {
      const outTimeIssue = error.issues.find((issue) => issue.path.at(-1) === "checkOutAt");

      return {
        error:
          outTimeIssue?.message === "Check-out must be later than check-in."
            ? "Out time must be later than in time."
            : "Check the day details and try again.",
        success: null
      };
    }

    return {
      error: error instanceof Error ? error.message : "We could not review this day.",
      success: null
    };
  }
}
