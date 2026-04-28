"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { visitSchema } from "@/lib/validation";

type MchVisitFormState = {
  error: string | null;
  success: string | null;
};

function localDateTimeToUtcIso(value: string, timezoneOffsetMinutes: number) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) + timezoneOffsetMinutes * 60_000;

  return new Date(utcMs).toISOString();
}

function buildLocalDateTime(date: string, time: string) {
  return `${date}T${time}`;
}

function getRelationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null | undefined
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? "another visit";
  }

  return relation?.name ?? "another visit";
}

function formatLocalTimeFromIso(value: string, timezoneOffsetMinutes: number) {
  const utcDate = new Date(value);
  const localMs = utcDate.getTime() - timezoneOffsetMinutes * 60_000;
  const localDate = new Date(localMs);

  return localDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export async function createVisitAction(
  _: MchVisitFormState,
  formData: FormData
): Promise<MchVisitFormState> {
  const parsedResult = visitSchema.safeParse({
    storeId: formData.get("storeId"),
    visitDate: formData.get("visitDate"),
    checkInAt: formData.get("checkInAt"),
    checkOutAt: formData.get("checkOutAt"),
    notes: formData.get("notes")
  });

  if (!parsedResult.success) {
    const error = parsedResult.error;
    const storeIssue = error.issues.find((issue) => issue.path[0] === "storeId");
    const inTimeIssue = error.issues.find((issue) => issue.path[0] === "checkInAt");
    const outTimeIssue = error.issues.find((issue) => issue.path[0] === "checkOutAt");

    return {
      error:
        storeIssue
          ? "Please select a store from the list."
          : inTimeIssue
            ? "Please choose an in time."
            : outTimeIssue?.message === "Check-out must be later than check-in."
          ? "Out time must be later than in time."
          : outTimeIssue
            ? "Please choose a valid out time."
            : "Check the visit details and try again.",
      success: null
    };
  }

  const parsed = parsedResult.data;

  const currentLocalDate = String(formData.get("currentLocalDate") ?? "").trim();
  const timezoneOffsetMinutes = Number(formData.get("timezoneOffsetMinutes") ?? "0");

  if (!currentLocalDate || parsed.visitDate !== currentLocalDate) {
    return {
      error: "You can only log hours for today.",
      success: null
    };
  }

  if (Number.isNaN(timezoneOffsetMinutes)) {
    return {
      error: "We could not determine your local time zone. Please reload and try again.",
      success: null
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const checkInAtIso = localDateTimeToUtcIso(
    buildLocalDateTime(parsed.visitDate, parsed.checkInAt),
    timezoneOffsetMinutes
  );
  const checkOutAtIso = localDateTimeToUtcIso(
    buildLocalDateTime(parsed.visitDate, parsed.checkOutAt),
    timezoneOffsetMinutes
  );

  const { data: existingVisits, error: existingVisitsError } = await supabase
    .from("visits")
    .select("id, check_in_at, check_out_at, stores(name)")
    .eq("mch_profile_id", user.id)
    .eq("visit_date", parsed.visitDate)
    .lt("check_in_at", checkOutAtIso)
    .gt("check_out_at", checkInAtIso);

  if (existingVisitsError) {
    return {
      error: "We could not validate your schedule. Please try again.",
      success: null
    };
  }

  if (existingVisits && existingVisits.length > 0) {
    const overlappingVisit = existingVisits[0];
    const storeName = getRelationName(overlappingVisit.stores);
    const overlapStart = formatLocalTimeFromIso(overlappingVisit.check_in_at, timezoneOffsetMinutes);
    const overlapEnd = formatLocalTimeFromIso(overlappingVisit.check_out_at, timezoneOffsetMinutes);

    return {
      error: `This visit overlaps with ${storeName} from ${overlapStart} to ${overlapEnd}. Visits cannot overlap.`,
      success: null
    };
  }

  const { error } = await supabase.from("visits").insert({
    mch_profile_id: user.id,
    store_id: parsed.storeId,
    visit_date: parsed.visitDate,
    check_in_at: checkInAtIso,
    check_out_at: checkOutAtIso,
    notes: parsed.notes ?? null
  });

  if (error) {
    return {
      error: "We could not save this visit. Please try again.",
      success: null
    };
  }

  revalidatePath("/mch/visits");

  return {
    error: null,
    success: "Visit saved."
  };
}
