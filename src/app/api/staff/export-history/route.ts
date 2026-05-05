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
  const rangeStart = dateFrom <= dateTo ? dateFrom : dateTo;
  const rangeEnd = dateFrom <= dateTo ? dateTo : dateFrom;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("visits")
    .select(
      `
        visit_date,
        check_in_at,
        check_out_at,
        profiles!visits_mch_profile_id_fkey(staffing_code, first_name, last_name, full_name),
        stores!visits_store_id_fkey(name)
      `
    )
    .eq("status", "approved")
    .gte("visit_date", rangeStart)
    .lte("visit_date", rangeEnd)
    .order("visit_date")
    .order("check_in_at");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows =
    data?.map((visit) => {
      const profile = getRelationData<{
        staffing_code?: string | null;
        full_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }>(visit.profiles);
      const store = getRelationData<{ name?: string | null }>(visit.stores);

      return {
        Date: formatExportDate(visit.visit_date),
        Merchandiser:
          profile?.full_name?.trim() ||
          [profile?.last_name, profile?.first_name].filter(Boolean).join(" ").trim() ||
          "Unknown",
        ID: profile?.staffing_code ?? "",
        Store: store?.name ?? "",
        IN: formatExportTime(visit.check_in_at),
        OUT: formatExportTime(visit.check_out_at)
      };
    }) ?? [];

  if (rows.length === 0) {
    return Response.json(
      { error: "No approved visit history is available for the selected range." },
      { status: 409 }
    );
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Visit History");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="visit-history-${rangeStart}-to-${rangeEnd}.xlsx"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
