import * as XLSX from "xlsx";

import { requireStaffUser } from "@/lib/auth/require-staff-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const staffUser = await requireStaffUser({ onFail: "null" });

  if (!staffUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      `
        staffing_code,
        first_name,
        last_name,
        phone_number,
        email,
        has_temporary_staffing_code,
        stores!profiles_default_store_id_fkey(name),
        agencies!profiles_agency_id_fkey(name)
      `
    )
    .eq("role", "mch")
    .order("last_name")
    .order("first_name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows =
    data?.map((row) => {
      const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
      const agency = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;

      return {
        ID: row.staffing_code ?? "",
        "Temporary ID": row.has_temporary_staffing_code ? "Yes" : "No",
        "First Name": row.first_name ?? "",
        "Last Name": row.last_name ?? "",
        Email: row.email ?? "",
        Phone: row.phone_number ?? "",
        Store: store?.name ?? "",
        Agency: agency?.name ?? ""
      };
    }) ?? [];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="users.xlsx"'
    }
  });
}
