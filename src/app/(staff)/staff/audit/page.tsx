import { StaffAuditDashboard } from "@/components/staff-audit-dashboard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type StaffAuditPageProps = {
  searchParams?: Promise<{
    dateFrom?: string;
    dateTo?: string;
    includeExported?: string;
  }>;
};

type VisitStatus = "pending" | "approved" | "rejected";

function parseDateOnly(value: string | undefined, fallback: string) {
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

function deriveDayStatus(statuses: VisitStatus[]): VisitStatus {
  if (statuses.length > 0 && statuses.every((status) => status === "approved")) {
    return "approved";
  }

  if (statuses.some((status) => status === "rejected")) {
    return "rejected";
  }

  return "pending";
}

export default async function StaffAuditPage({ searchParams }: StaffAuditPageProps) {
  const resolvedSearchParams = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const fallbackDateFrom = shiftDate(today, -6);
  const dateFrom = parseDateOnly(resolvedSearchParams?.dateFrom, fallbackDateFrom);
  const dateTo = parseDateOnly(resolvedSearchParams?.dateTo, today);
  const includeExported = resolvedSearchParams?.includeExported === "1";
  const rangeStart = dateFrom <= dateTo ? dateFrom : dateTo;
  const rangeEnd = dateFrom <= dateTo ? dateTo : dateFrom;

  const admin = createAdminSupabaseClient();
  const { data: visits } = await admin
    .from("visits")
    .select(
      `
        id,
        mch_profile_id,
        visit_date,
        check_in_at,
        check_out_at,
        notes,
        rejection_reason,
        exported_at,
        status,
        profiles!visits_mch_profile_id_fkey(id, staffing_code, first_name, last_name, full_name),
        stores!visits_store_id_fkey(name)
      `
    )
    .gte("visit_date", rangeStart)
    .lte("visit_date", rangeEnd)
    .order("visit_date", { ascending: false })
    .order("check_in_at", { ascending: true });

  const merchandisersMap = new Map<
    string,
    {
      id: string;
      name: string;
      staffingCode: string | null;
      totalVisits: number;
      pendingVisits: number;
      approvedVisits: number;
      rejectedVisits: number;
      daysMap: Map<
        string,
        {
          date: string;
          totalVisits: number;
          pendingVisits: number;
          approvedVisits: number;
          rejectedVisits: number;
          statuses: VisitStatus[];
          visits: Array<{
            id: string;
            storeName: string;
            checkInAt: string;
            checkOutAt: string;
            notes: string | null;
            rejectionReason: string | null;
            status: VisitStatus;
          }>;
        }
      >;
    }
  >();

  for (const visit of visits ?? []) {
    const profile = getRelationData<{
      id?: string;
      staffing_code?: string | null;
      full_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    }>(visit.profiles);
    const store = getRelationData<{ name?: string | null }>(visit.stores);

    if (!profile?.id) {
      continue;
    }

    const merchandiserName =
      profile.full_name?.trim() ||
      [profile.last_name, profile.first_name].filter(Boolean).join(" ").trim() ||
      "Unnamed merchandiser";

    if (!merchandisersMap.has(profile.id)) {
      merchandisersMap.set(profile.id, {
        id: profile.id,
        name: merchandiserName,
        staffingCode: profile.staffing_code ?? null,
        totalVisits: 0,
        pendingVisits: 0,
        approvedVisits: 0,
        rejectedVisits: 0,
        daysMap: new Map()
      });
    }

    const merchandiser = merchandisersMap.get(profile.id)!;
    const status = (visit.status ?? "pending") as VisitStatus;

    merchandiser.totalVisits += 1;
    if (status === "approved") {
      merchandiser.approvedVisits += 1;
    } else if (status === "rejected") {
      merchandiser.rejectedVisits += 1;
    } else {
      merchandiser.pendingVisits += 1;
    }

    if (!merchandiser.daysMap.has(visit.visit_date)) {
      merchandiser.daysMap.set(visit.visit_date, {
        date: visit.visit_date,
        totalVisits: 0,
        pendingVisits: 0,
        approvedVisits: 0,
        rejectedVisits: 0,
        statuses: [],
        visits: []
      });
    }

    const day = merchandiser.daysMap.get(visit.visit_date)!;
    day.totalVisits += 1;
    day.statuses.push(status);
    if (status === "approved") {
      day.approvedVisits += 1;
    } else if (status === "rejected") {
      day.rejectedVisits += 1;
    } else {
      day.pendingVisits += 1;
    }
    day.visits.push({
      id: visit.id,
      storeName: store?.name ?? "-",
      checkInAt: visit.check_in_at,
      checkOutAt: visit.check_out_at,
      notes: visit.notes,
      rejectionReason: visit.rejection_reason,
      status
    });
  }

  const merchandisers = Array.from(merchandisersMap.values())
    .map((merchandiser) => ({
      id: merchandiser.id,
      name: merchandiser.name,
      staffingCode: merchandiser.staffingCode,
      totalVisits: merchandiser.totalVisits,
      pendingVisits: merchandiser.pendingVisits,
      approvedVisits: merchandiser.approvedVisits,
      rejectedVisits: merchandiser.rejectedVisits,
      days: Array.from(merchandiser.daysMap.values())
        .map((day) => ({
          date: day.date,
          totalVisits: day.totalVisits,
          pendingVisits: day.pendingVisits,
          approvedVisits: day.approvedVisits,
          rejectedVisits: day.rejectedVisits,
          status: deriveDayStatus(day.statuses),
          visits: day.visits
        }))
        .sort((left, right) => right.date.localeCompare(left.date))
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const approvedVisitsCount = (visits ?? []).filter((visit) => visit.status === "approved").length;
  const readyToExportCount = (visits ?? []).filter(
    (visit) => visit.status === "approved" && !visit.exported_at
  ).length;

  return (
    <>
      <section className="section">
        <div className="audit-control-grid">
          <article className="card audit-filter-card">
            <p className="eyebrow">Review Queue</p>
            <h2 className="section-title">Approve Hours</h2>
            <p className="section-copy">
              Review submitted visits by date range, open each merchandiser day, and approve or reject the final schedule before payroll export.
            </p>
            <form className="form section" method="get">
              <div className="form-row">
                <div className="field">
                  <label htmlFor="dateFrom">Date from</label>
                  <input id="dateFrom" name="dateFrom" type="date" defaultValue={rangeStart} />
                </div>
                <div className="field">
                  <label htmlFor="dateTo">Date to</label>
                  <input id="dateTo" name="dateTo" type="date" defaultValue={rangeEnd} />
                </div>
              </div>
              <div className="actions">
                <button type="submit">Apply filter</button>
              </div>
            </form>
          </article>

          <article className="card audit-export-card">
            <div className="audit-export-header">
              <div>
                <p className="eyebrow">Payroll Export</p>
                <h2 className="section-title">Download Hours</h2>
              </div>
              <span className="audit-export-badge">{readyToExportCount} new</span>
            </div>

            <p className="section-copy">
              Export approved hours in payroll-ready XLSX format. By default, the file includes only hours that have never been downloaded before.
            </p>

            <div className="audit-export-stats">
              <div className="audit-stat-chip">
                <strong>{approvedVisitsCount}</strong>
                <span>Approved visits in range</span>
              </div>
              <div className="audit-stat-chip audit-stat-chip-highlight">
                <strong>{readyToExportCount}</strong>
                <span>Ready to download now</span>
              </div>
            </div>

            <form className="form section" action="/api/staff/export" method="get">
              <input type="hidden" name="dateFrom" value={rangeStart} />
              <input type="hidden" name="dateTo" value={rangeEnd} />
              <label className="export-toggle export-toggle-card">
                <input
                  id="includeExported"
                  name="includeExported"
                  type="checkbox"
                  value="1"
                  defaultChecked={includeExported}
                />
                <span>
                  Include already downloaded hours
                  <small>Turn this on only if you want to rebuild the full export.</small>
                </span>
              </label>
              <div className="actions">
                <button className="audit-download-button" type="submit">
                  Download Hours XLSX
                </button>
                <button className="button secondary" formAction="/api/staff/export-history" type="submit">
                  Download History XLSX
                </button>
              </div>
            </form>
          </article>
        </div>
      </section>

      <StaffAuditDashboard merchandisers={merchandisers} />
    </>
  );
}
