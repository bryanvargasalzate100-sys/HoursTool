import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
import { BrandLockup } from "@/components/brand-lockup";
import { MchVisitForm } from "@/components/mch-visit-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MchVisitsPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatCardDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function formatWeekdayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short"
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function getRelationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null | undefined
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? "-";
  }

  return relation?.name ?? "-";
}

export default async function MchVisitsPage({ searchParams }: MchVisitsPageProps) {
  const today = new Date();
  const resolvedSearchParams = await searchParams;
  const selectedDate = parseDateParam(resolvedSearchParams?.date, today);
  const selectedDateKey = toDateOnly(selectedDate);
  const todayKey = toDateOnly(today);
  const canSubmit = selectedDateKey === todayKey;
  const startOfWeek = addDays(selectedDate, -selectedDate.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek, index));
  const previousWeekDate = toDateOnly(addDays(startOfWeek, -7));
  const nextWeekDate = toDateOnly(addDays(startOfWeek, 7));

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: stores }, { data: visits }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("stores").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("visits")
      .select("id, visit_date, check_in_at, check_out_at, status, rejection_reason, stores(name)")
      .eq("mch_profile_id", user.id)
      .eq("visit_date", selectedDateKey)
      .order("check_in_at")
  ]);

  if (profile?.role === "staff") {
    redirect("/staff/audit");
  }

  const visitRows =
    visits?.map((visit) => ({
      id: visit.id,
      storeName: getRelationName(visit.stores),
      visitDate: visit.visit_date,
      checkInAt: visit.check_in_at,
      checkOutAt: visit.check_out_at,
      status: visit.status ?? "pending",
      rejectionReason: visit.rejection_reason ?? null
    })) ?? [];

  return (
    <main className="shell">
      <section className="workspace-header">
        <div>
          <BrandLockup
            eyebrow="Falcon Farms"
            title="FieldOps"
            subtitle="Merchandiser visit log"
            compact
          />
          <h1>Visit Log</h1>
        </div>

        <div className="actions">
          <form action={signOutAction}>
            <button className="button secondary" type="submit">
              Logout
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="audit-control-grid">
          <article className="card audit-filter-card">
            <p className="eyebrow">Schedule View</p>
            <h2 className="section-title">Weekly Timeline</h2>
            <p className="section-copy">
              Move across the week, focus on one day, and keep today&apos;s entries clean before they move into approval.
            </p>
            <div className="week-toolbar">
              <Link className="button secondary week-nav-button" href={`/mch/visits?date=${previousWeekDate}`}>
                ←
              </Link>
              <div className="week-grid">
                {weekDays.map((day) => {
                  const dayKey = toDateOnly(day);
                  const isSelected = dayKey === selectedDateKey;
                  const isToday = dayKey === todayKey;

                  return (
                    <Link
                      key={dayKey}
                      className={`day-card${isSelected ? " day-card-active" : ""}${isToday ? " day-card-today" : ""}`}
                      href={`/mch/visits?date=${dayKey}`}
                    >
                      <span className="day-card-weekday">{formatWeekdayLabel(day)}</span>
                      <strong className="day-card-date">{formatDayLabel(day)}</strong>
                    </Link>
                  );
                })}
              </div>
              <Link className="button secondary week-nav-button" href={`/mch/visits?date=${nextWeekDate}`}>
                →
              </Link>
            </div>
          </article>

          <article className="card audit-export-card">
            <div className="audit-export-header">
              <div>
                <p className="eyebrow">Daily Status</p>
                <h2 className="section-title">Today&apos;s Log</h2>
              </div>
              <span className="audit-export-badge">{visitRows.length} entries</span>
            </div>

            <p className="section-copy">
              Track what is already logged for the selected date and know immediately whether you can still add hours.
            </p>

            <div className="audit-export-stats">
              <div className="audit-stat-chip">
                <strong>{formatCardDate(selectedDate)}</strong>
                <span>Current day in focus</span>
              </div>
              <div className="audit-stat-chip audit-stat-chip-highlight">
                <strong>{canSubmit ? "Open" : "Closed"}</strong>
                <span>{canSubmit ? "You can add visits for today" : "Only today can receive new visits"}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <article className="card data-table-card">
          <h2 className="section-title">Daily Visits</h2>
          <MchVisitForm
            stores={stores ?? []}
            visits={visitRows}
            selectedDate={selectedDateKey}
            canSubmit={canSubmit}
          />
        </article>
      </section>
    </main>
  );
}
