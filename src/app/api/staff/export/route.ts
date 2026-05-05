import * as XLSX from "xlsx";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const EXPORT_TIMEZONE = "America/Bogota";

function parseDateOnly(value: string | null, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return value;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getRelationData<T extends Record<string, unknown>>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatExportDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

function formatExportTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: EXPORT_TIMEZONE
  }).format(new Date(value));
}

function parseIncludeExported(value: string | null) {
  return value === "1" || value === "true" || value === "on";
}

function buildExportRows(data: Array<{
  visit_date: string;
  check_in_at: string;
  check_out_at: string;
  profiles:
    | {
        staffing_code?: string | null;
        full_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | Array<{
        staffing_code?: string | null;
        full_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }>
    | null;
}>) {
  return data.flatMap((visit) => {
    const profile = getRelationData<{
      staffing_code?: string | null;
      full_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    }>(visit.profiles);

    const exportName =
      [profile?.last_name, profile?.first_name]
        .filter(Boolean)
        .join(", ")
        .trim()
        .toLowerCase() ||
      profile?.full_name?.trim().toLowerCase() ||
      "unknown";

    const key = profile?.staffing_code ?? "";
    const date = formatExportDate(visit.visit_date);

    return [
      [date, exportName, key, formatExportTime(visit.check_in_at)],
      [date, exportName, key, formatExportTime(visit.check_out_at)]
    ];
  });
}

export async function GET(request: Request) {
  const staffUser = await requireStaffUser({ onFail: "null" });

  if (!staffUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const fallbackDateFrom = shiftDate(today, -6);
  const { searchParams } = new URL(request.url);
  const dateFrom = parseDateOnly(searchParams.get("dateFrom"), fallbackDateFrom);
  const dateTo = parseDateOnly(searchParams.get("dateTo"), today);
  const includeExported = parseIncludeExported(searchParams.get("includeExported"));
  const rangeStart = dateFrom <= dateTo ? dateFrom : dateTo;
  const rangeEnd = dateFrom <= dateTo ? dateTo : dateFrom;

  const admin = createAdminSupabaseClient();
  let exportQuery = admin
    .from("visits")
    .select(
      `
        id,
        visit_date,
        check_in_at,
        check_out_at,
        exported_at,
        profiles!visits_mch_profile_id_fkey(staffing_code, first_name, last_name, full_name)
      `
    )
    .eq("status", "approved")
    .gte("visit_date", rangeStart)
    .lte("visit_date", rangeEnd)
    .order("visit_date")
    .order("check_in_at");

  if (!includeExported) {
    exportQuery = exportQuery.is("exported_at", null);
  }

  const { data, error } = await exportQuery;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = buildExportRows(data ?? []);

  const unexportedVisitIds =
    data
      ?.filter((visit) => !visit.exported_at)
      .map((visit) => visit.id) ?? [];

  if (rows.length === 0) {
    return Response.json(
      { error: "No approved hours are ready to download for the selected range." },
      { status: 409 }
    );
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([["Date", "#Name", "Key", "Time"], ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hours");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  if (unexportedVisitIds.length > 0) {
    const { error: exportMarkError } = await admin
      .from("visits")
      .update({
        exported_at: new Date().toISOString(),
        exported_by: staffUser.id
      })
      .in("id", unexportedVisitIds)
      .is("exported_at", null);

    if (exportMarkError) {
      return Response.json({ error: exportMarkError.message }, { status: 500 });
    }
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${includeExported ? "approved-hours-all" : "approved-hours-new"}-${rangeStart}-to-${rangeEnd}-${Date.now()}.xlsx"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
