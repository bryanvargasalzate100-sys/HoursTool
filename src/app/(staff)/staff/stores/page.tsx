import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { createStoreAction, uploadStoresAction } from "./actions";

export default async function StaffStoresPage() {
  const admin = createAdminSupabaseClient();
  const { count: storesCount } = await admin
    .from("stores")
    .select("*", { count: "exact", head: true });

  const { data: stores } = await admin
    .from("stores")
    .select("id, name, customer")
    .order("name")
    .limit(100);

  return (
    <>
      <section className="section">
        <div className="audit-control-grid">
          <article className="card audit-filter-card">
            <p className="eyebrow">Manual Setup</p>
            <h2 className="section-title">Create Stores</h2>
            <p className="section-copy">
              Add single locations quickly when operations needs a new destination before the next bulk upload.
            </p>
            <form className="form" action={createStoreAction}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="name">Store</label>
                  <input id="name" name="name" type="text" placeholder="1103 Walmart" />
                </div>
                <div className="field">
                  <label htmlFor="customer">Customer</label>
                  <input id="customer" name="customer" type="text" placeholder="Walmart" />
                </div>
              </div>
              <div className="actions">
                <button type="submit">Add store</button>
              </div>
            </form>
          </article>

          <article className="card audit-export-card">
            <div className="audit-export-header">
              <div>
                <p className="eyebrow">Coverage</p>
                <h2 className="section-title">Store Network</h2>
              </div>
              <span className="audit-export-badge">{storesCount ?? 0} live</span>
            </div>

            <p className="section-copy">
              Keep the location list clean and current so users always find the right store while logging hours.
            </p>

            <div className="audit-export-stats">
              <div className="audit-stat-chip">
                <strong>{storesCount ?? 0}</strong>
                <span>Total stores available to field users</span>
              </div>
              <div className="audit-stat-chip audit-stat-chip-highlight">
                <strong>{stores?.length ?? 0}</strong>
                <span>Visible in this directory snapshot</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <article className="card feature-card">
          <p className="eyebrow">Bulk Operations</p>
          <h2 className="section-title">Upload Store Lists</h2>
          <form className="form" action={uploadStoresAction}>
            <div className="field">
              <label htmlFor="stores-file">CSV or Excel file</label>
              <input id="stores-file" name="stores-file" type="file" accept=".csv,.xlsx,.xls" />
            </div>
            <p className="section-copy">
              Suggested format: <code>store</code> and <code>customer</code>. Store name is the unique value.
            </p>
            <div className="actions">
              <button type="submit">Upload stores</button>
            </div>
          </form>
        </article>
      </section>

      <section className="card section data-table-card">
        <h2 className="section-title">Store Directory</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Customer</th>
            </tr>
          </thead>
          <tbody>
            {stores && stores.length > 0 ? (
              stores.map((store) => (
                <tr key={store.id}>
                  <td>{store.name}</td>
                  <td>{store.customer}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>No stores loaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="section-copy">{storesCount ?? 0} store(s) loaded.</p>
      </section>
    </>
  );
}
