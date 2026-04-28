"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { reviewVisitDayAction } from "@/app/(staff)/staff/audit/actions";

type AuditVisit = {
  id: string;
  storeName: string;
  checkInAt: string;
  checkOutAt: string;
  notes: string | null;
  rejectionReason: string | null;
  status: "pending" | "approved" | "rejected";
};

type AuditDay = {
  date: string;
  status: "pending" | "approved" | "rejected";
  totalVisits: number;
  pendingVisits: number;
  approvedVisits: number;
  rejectedVisits: number;
  visits: AuditVisit[];
};

type MerchandiserAuditGroup = {
  id: string;
  name: string;
  staffingCode: string | null;
  totalVisits: number;
  pendingVisits: number;
  approvedVisits: number;
  rejectedVisits: number;
  days: AuditDay[];
};

type StaffAuditDashboardProps = {
  merchandisers: MerchandiserAuditGroup[];
};

type ReviewDayState = {
  error: string | null;
  success: string | null;
};

type DraftVisit = {
  id: string;
  storeName: string;
  checkInAt: string;
  checkOutAt: string;
  notes: string;
  rejectionReason: string | null;
  status: "pending" | "approved" | "rejected";
};

const initialState: ReviewDayState = {
  error: null,
  success: null
};

function isoToTimeInput(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatLocalDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatTimeLabel(value: string) {
  return new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function timeInputToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getDayStatusLabel(status: AuditDay["status"]) {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending";
}

function getVisitStatusLabel(status: AuditVisit["status"]) {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending review";
}

function buildTimelineHours() {
  return Array.from({ length: 24 }, (_, hour) => hour);
}

export function StaffAuditDashboard({ merchandisers }: StaffAuditDashboardProps) {
  const [expandedMerchId, setExpandedMerchId] = useState<string | null>(merchandisers[0]?.id ?? null);
  const [selectedDay, setSelectedDay] = useState<{
    merchandiserId: string;
    merchandiserName: string;
    day: AuditDay;
  } | null>(null);

  useEffect(() => {
    if (!expandedMerchId && merchandisers[0]) {
      setExpandedMerchId(merchandisers[0].id);
    }
  }, [expandedMerchId, merchandisers]);

  return (
    <>
      <section className="audit-list section">
        {merchandisers.length > 0 ? (
          merchandisers.map((merchandiser) => {
            const isExpanded = expandedMerchId === merchandiser.id;

            return (
              <article key={merchandiser.id} className="audit-merch-card">
                <button
                  type="button"
                  className="audit-merch-trigger"
                  onClick={() => setExpandedMerchId(isExpanded ? null : merchandiser.id)}
                >
                  <div>
                    <strong>{merchandiser.name}</strong>
                    <span>
                      {merchandiser.staffingCode ? `ID ${merchandiser.staffingCode}` : "No ID"}
                    </span>
                  </div>
                  <div className="audit-merch-meta">
                    <span>{merchandiser.totalVisits} visit(s)</span>
                    <span>{merchandiser.pendingVisits} pending</span>
                    <span>{merchandiser.approvedVisits} approved</span>
                    <span>{merchandiser.rejectedVisits} rejected</span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="audit-day-grid">
                    {merchandiser.days.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        className="audit-day-card"
                        onClick={() =>
                          setSelectedDay({
                            merchandiserId: merchandiser.id,
                            merchandiserName: merchandiser.name,
                            day
                          })
                        }
                        >
                          <strong>{formatLocalDateLabel(day.date)}</strong>
                          <span>{day.totalVisits} visit(s)</span>
                          <span>{day.pendingVisits} pending</span>
                          <span>{day.rejectedVisits} rejected</span>
                          <span className={`status-pill status-${day.status}`}>
                            {getDayStatusLabel(day.status)}
                          </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <article className="card">
            <h2 className="section-title">No hours found</h2>
            <p className="section-copy">
              No merchandiser visits match the selected date range.
            </p>
          </article>
        )}
      </section>

      {selectedDay ? (
        <StaffAuditDayModal
          key={`${selectedDay.merchandiserId}-${selectedDay.day.date}`}
          merchandiserId={selectedDay.merchandiserId}
          merchandiserName={selectedDay.merchandiserName}
          day={selectedDay.day}
          onClose={() => setSelectedDay(null)}
        />
      ) : null}
    </>
  );
}

function StaffAuditDayModal({
  merchandiserId,
  merchandiserName,
  day,
  onClose
}: {
  merchandiserId: string;
  merchandiserName: string;
  day: AuditDay;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(reviewVisitDayAction, initialState);
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState("0");
  const [draftVisits, setDraftVisits] = useState<DraftVisit[]>([]);
  const [submittedIntent, setSubmittedIntent] = useState<"save" | "approve" | "reject">("save");
  const [rejectionReason, setRejectionReason] = useState("");
  const hours = useMemo(() => buildTimelineHours(), []);

  useEffect(() => {
    setTimezoneOffsetMinutes(String(new Date().getTimezoneOffset()));
  }, []);

  useEffect(() => {
    setDraftVisits(
      day.visits.map((visit) => ({
        id: visit.id,
        storeName: visit.storeName,
        checkInAt: isoToTimeInput(visit.checkInAt),
        checkOutAt: isoToTimeInput(visit.checkOutAt),
        notes: visit.notes ?? "",
        rejectionReason: visit.rejectionReason,
        status: visit.status
      }))
    );
    setRejectionReason(
      day.visits.find((visit) => visit.rejectionReason?.trim())?.rejectionReason?.trim() ?? ""
    );
  }, [day]);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();

    if (submittedIntent === "approve" || submittedIntent === "reject") {
      onClose();
    }
  }, [onClose, router, state.success, submittedIntent]);

  const payload = JSON.stringify(
    draftVisits.map((visit) => ({
      id: visit.id,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      notes: visit.notes.trim() ? visit.notes.trim() : null
    }))
  );

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card audit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-day-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Audit Day</p>
            <h2 id="audit-day-title" className="section-title">
              {merchandiserName} · {formatLocalDateLabel(day.date)}
            </h2>
            <p className="section-copy">
              Review the logged visits, adjust the hours if needed, and approve the day when everything looks right.
            </p>
          </div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="timeline-card">
          <div className="timeline-summary-bar">
            <strong>Day timeline</strong>
            <span>Visual check of the merchandiser schedule before approval.</span>
          </div>
          <div className="timeline-grid">
            <div className="timeline-visits-layer">
              {draftVisits.map((visit) => {
                const top = timeInputToMinutes(visit.checkInAt);
                const height = Math.max(timeInputToMinutes(visit.checkOutAt) - top, 48);

                return (
                  <div
                    key={visit.id}
                    className="timeline-visit-block"
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                    <strong>{visit.storeName}</strong>
                    <span>
                      {formatTimeLabel(visit.checkInAt)}
                      {" - "}
                      {formatTimeLabel(visit.checkOutAt)}
                    </span>
                  </div>
                );
              })}
            </div>

            {hours.map((hour) => {
              const period = hour >= 12 ? "PM" : "AM";
              const normalizedHour = hour % 12 || 12;

              return (
                <div key={hour} className="timeline-slot">
                  <span className="timeline-hour-label">{`${normalizedHour}:00 ${period}`}</span>
                  <span className="timeline-hour-line" />
                </div>
              );
            })}
          </div>
        </div>

        <form className="form section" action={formAction}>
          <input type="hidden" name="mchProfileId" value={merchandiserId} />
          <input type="hidden" name="visitDate" value={day.date} />
          <input type="hidden" name="timezoneOffsetMinutes" value={timezoneOffsetMinutes} />
          <input type="hidden" name="payload" value={payload} />

          <div className="audit-review-list">
            {draftVisits.map((visit, index) => (
              <article key={visit.id} className="audit-review-row">
                <div className="audit-review-heading">
                  <div>
                    <strong>{visit.storeName}</strong>
                    <span>{getVisitStatusLabel(visit.status)}</span>
                  </div>
                  <span className={`status-pill status-${visit.status}`}>{getVisitStatusLabel(visit.status)}</span>
                </div>

                <div className="form-row">
                  <div className="field">
                    <label htmlFor={`checkInAt-${visit.id}`}>In</label>
                    <input
                      id={`checkInAt-${visit.id}`}
                      type="time"
                      step="60"
                      value={visit.checkInAt}
                      onChange={(event) =>
                        setDraftVisits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, checkInAt: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`checkOutAt-${visit.id}`}>Out</label>
                    <input
                      id={`checkOutAt-${visit.id}`}
                      type="time"
                      step="60"
                      value={visit.checkOutAt}
                      onChange={(event) =>
                        setDraftVisits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, checkOutAt: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor={`notes-${visit.id}`}>Notes</label>
                  <textarea
                    id={`notes-${visit.id}`}
                    rows={3}
                    value={visit.notes}
                    onChange={(event) =>
                      setDraftVisits((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, notes: event.target.value } : item
                        )
                      )
                    }
                  />
                </div>

                {visit.rejectionReason ? (
                  <p className="note">Previous rejection reason: {visit.rejectionReason}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="field">
            <label htmlFor="rejectionReason">Rejection reason (optional)</label>
            <textarea
              id="rejectionReason"
              name="rejectionReason"
              rows={3}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Explain why these hours were not approved."
            />
          </div>

          {state.error ? <p className="form-error">{state.error}</p> : null}
          {state.success ? <p className="form-success">{state.success}</p> : null}

          <div className="actions">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={isPending}
              onClick={() => setSubmittedIntent("save")}
            >
              {isPending && submittedIntent === "save" ? "Saving..." : "Save changes"}
            </button>
            <button
              className="button secondary"
              type="submit"
              name="intent"
              value="approve"
              disabled={isPending}
              onClick={() => setSubmittedIntent("approve")}
            >
              {isPending && submittedIntent === "approve" ? "Approving..." : "Approve day"}
            </button>
            <button
              className="button secondary"
              type="submit"
              name="intent"
              value="reject"
              disabled={isPending}
              onClick={() => setSubmittedIntent("reject")}
            >
              {isPending && submittedIntent === "reject" ? "Rejecting..." : "Reject day"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
