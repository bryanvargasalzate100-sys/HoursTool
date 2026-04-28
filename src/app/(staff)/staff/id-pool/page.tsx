import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { uploadStaffingIdsAction } from "./actions";

export default async function StaffIdPoolPage() {
  const admin = createAdminSupabaseClient();
  const { data: poolItems } = await admin
    .from("staffing_id_pool")
    .select("id, staffing_code, is_assigned, created_at")
    .order("staffing_code");

  const { count: temporaryProfilesCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "mch")
    .eq("has_temporary_staffing_code", true);

  return (
    <>
      <section className="section">
        <div className="audit-control-grid">
          <article className="card audit-filter-card">
            <p className="eyebrow">Code Intake</p>
            <h2 className="section-title">Manage Code Pool</h2>
            <p className="section-copy">
              Upload real staffing codes here so new users receive permanent IDs and temporary codes can be replaced automatically.
            </p>
            <form className="form" action={uploadStaffingIdsAction}>
              <div className="field">
                <label htmlFor="ids-file">CSV or Excel file</label>
                <input id="ids-file" name="ids-file" type="file" accept=".csv,.xlsx,.xls" />
              </div>
              <p className="section-copy">
                Suggested format: one column named <code>staffing_code</code>. Each code must stay unique across the system.
              </p>
              <div className="actions">
                <button type="submit">Upload file</button>
                <a className="button secondary" href="/api/staff/export-users">
                  Download users XLSX
                </a>
              </div>
            </form>
          </article>

          <article className="card audit-export-card">
            <div className="audit-export-header">
              <div>
                <p className="eyebrow">Assignment Health</p>
                <h2 className="section-title">ID Coverage</h2>
              </div>
              <span className="audit-export-badge">{temporaryProfilesCount ?? 0} pending</span>
            </div>

            <p className="section-copy">
              Keep the pool healthy so account creation, reporting, and payroll exports stay consistent across the operation.
            </p>

            <div className="audit-export-stats">
              <div className="audit-stat-chip">
                <strong>{poolItems?.length ?? 0}</strong>
                <span>Codes currently loaded in the database</span>
              </div>
              <div className="audit-stat-chip audit-stat-chip-highlight">
                <strong>{temporaryProfilesCount ?? 0}</strong>
                <span>Users still waiting for a permanent code</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="card section data-table-card">
        <h2 className="section-title">Available Codes</h2>
        <p className="section-copy">
          {temporaryProfilesCount ?? 0} user(s) still have a temporary ID waiting to be replaced.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Imported</th>
            </tr>
          </thead>
          <tbody>
            {poolItems && poolItems.length > 0 ? (
              poolItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.staffing_code}</td>
                  <td>{item.is_assigned ? "Assigned" : "Available"}</td>
                  <td>{new Date(item.created_at).toLocaleDateString("en-US")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>No codes uploaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
