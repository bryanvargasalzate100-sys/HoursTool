"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createVisitAction } from "@/app/mch/visits/actions";
import { SearchableSelect } from "@/components/searchable-select";
import { TimePickerField } from "@/components/time-picker-field";

type MchVisitFormState = {
  error: string | null;
  success: string | null;
};

type MchVisitFormProps = {
  stores: Array<{
    id: string;
    name: string;
  }>;
  visits: Array<{
    id: string;
    storeName: string;
    checkInAt: string;
    checkOutAt: string;
    status: "pending" | "approved" | "rejected";
    rejectionReason: string | null;
  }>;
  selectedDate: string;
  canSubmit: boolean;
};

const initialState: MchVisitFormState = {
  error: null,
  success: null
};

export function MchVisitForm({
  stores,
  visits,
  selectedDate,
  canSubmit
}: MchVisitFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, isPending] = useActionState(createVisitAction, initialState);
  const [storesLoading, setStoresLoading] = useState(true);
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState("0");
  const [currentLocalDate, setCurrentLocalDate] = useState(selectedDate);
  const [isOpen, setIsOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [draftStoreId, setDraftStoreId] = useState("");
  const [draftStoreQuery, setDraftStoreQuery] = useState("");
  const [draftStoreLabel, setDraftStoreLabel] = useState("");
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("10:00");
  const [draftNotes, setDraftNotes] = useState("");

  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  function formatHourLabel(hour: number) {
    const period = hour >= 12 ? "PM" : "AM";
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:00 ${period}`;
  }

  function getStatusLabel(status: "pending" | "approved" | "rejected") {
    if (status === "approved") {
      return "Approved";
    }

    if (status === "rejected") {
      return "Rejected";
    }

    return "Pending";
  }

  function toTimeInput(hour: number, minute = 0) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function minutesToTimeInput(totalMinutes: number) {
    const safeMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
    const hour = Math.floor(safeMinutes / 60);
    const minute = safeMinutes % 60;

    return toTimeInput(hour, minute);
  }

  function getMinutesFromLocalIso(value: string) {
    const date = new Date(value);
    return date.getHours() * 60 + date.getMinutes();
  }

  function timeValueToMinutes(value: string) {
    const [hour = "0", minute = "0"] = value.split(":");
    return Number(hour) * 60 + Number(minute);
  }

  function openVisitModal(startMinutes: number, endMinutes: number) {
    const normalizedStart = Math.max(0, Math.min(startMinutes, 23 * 60));
    const normalizedEnd = Math.max(normalizedStart + 1, Math.min(endMinutes, 24 * 60 - 1));

    setDraftStoreId("");
    setDraftStoreQuery("");
    setDraftStoreLabel("");
    setDraftStartTime(minutesToTimeInput(normalizedStart));
    setDraftEndTime(minutesToTimeInput(normalizedEnd));
    setDraftNotes("");
    setIsOpen(true);
  }

  function openDefaultVisitModal() {
    const now = new Date();
    const isToday = currentLocalDate === selectedDate;
    const startMinutes = isToday
      ? now.getHours() * 60 + now.getMinutes()
      : 9 * 60;
    const endMinutes = Math.min(startMinutes + 60, 24 * 60);

    openVisitModal(startMinutes, endMinutes);
  }

  useEffect(() => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    setTimezoneOffsetMinutes(String(now.getTimezoneOffset()));
    setCurrentLocalDate(localDate);

    let cancelled = false;

    async function warmStoresSearch() {
      try {
        const response = await fetch("/api/mch/stores-options", {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Could not load stores.");
        }
      } catch {
        // Keep the form usable for retries when the user starts typing again.
      } finally {
        if (!cancelled) {
          setStoresLoading(false);
        }
      }
    }

    warmStoresSearch();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setIsOpen(false);
      setModalKey((value) => value + 1);
      setDraftStoreId("");
      setDraftStoreQuery("");
      setDraftStoreLabel("");
      setDraftNotes("");
    }
  }, [state.success]);

  return (
    <>
      <div className="actions">
        <button type="button" disabled={!canSubmit} onClick={openDefaultVisitModal}>
          Add Visit
        </button>
      </div>

      {!canSubmit ? <p className="note">You can only add visits for today.</p> : null}
      {state.success ? <p className="form-success">{state.success}</p> : null}

      <div className="timeline-card section">
        <div className="timeline-summary-bar">
          <strong>Day timeline</strong>
          <span>Visual reference of the visits already logged for this day.</span>
        </div>
        <div className="timeline-grid">
          {visits.length === 0 ? (
            <div className="timeline-empty-state">
              <strong>No visits logged yet.</strong>
              <span>Add a visit to start building the day view.</span>
            </div>
          ) : null}

          <div className="timeline-visits-layer">
            {visits.map((visit) => {
              const startMinutes = getMinutesFromLocalIso(visit.checkInAt);
              const endMinutes = getMinutesFromLocalIso(visit.checkOutAt);
              const top = startMinutes;
              const height = Math.max(endMinutes - startMinutes, 48);

              return (
                <div
                  key={visit.id}
                  className="timeline-visit-block"
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <strong>{visit.storeName}</strong>
                  <span className={`status-pill status-${visit.status}`}>{getStatusLabel(visit.status)}</span>
                  <span>
                    {new Date(visit.checkInAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                    {" - "}
                    {new Date(visit.checkOutAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </span>
                  {visit.rejectionReason ? <span>{visit.rejectionReason}</span> : null}
                </div>
              );
            })}
          </div>

          {hours.map((hour) => (
            <div key={hour} className="timeline-slot">
              <span className="timeline-hour-label">{formatHourLabel(hour)}</span>
              <span className="timeline-hour-line" />
            </div>
          ))}
        </div>
      </div>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            key={modalKey}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-visit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Add Visit</p>
                <h2 id="add-visit-title" className="section-title">
                  Log hours for {selectedDate}
                </h2>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setModalKey((value) => value + 1);
                  setDraftStoreId("");
                  setDraftStoreQuery("");
                  setDraftStoreLabel("");
                  setDraftNotes("");
                }}
              >
                Close
              </button>
            </div>

            <form ref={formRef} className="form" action={formAction}>
              <input name="visitDate" type="hidden" value={selectedDate} />
              <input name="timezoneOffsetMinutes" type="hidden" value={timezoneOffsetMinutes} />
              <input name="currentLocalDate" type="hidden" value={currentLocalDate} />

              <div className="form-row form-row-store">
                <SearchableSelect
                  id="storeId"
                  name="storeId"
                  label="Store"
                  placeholder={storesLoading ? "Loading stores..." : "Search by store name or number"}
                  options={stores.map((store) => ({
                    id: store.id,
                    label: store.name
                  }))}
                  value={draftStoreId}
                  query={draftStoreQuery}
                  selectedLabel={draftStoreLabel}
                  onQueryChange={setDraftStoreQuery}
                  onSelectionChange={(option) => {
                    setDraftStoreId(option?.id ?? "");
                    setDraftStoreLabel(option?.label ?? "");
                    if (option?.label) {
                      setDraftStoreQuery(option.label);
                    }
                  }}
                  loadOptions={async (query) => {
                    const params = new URLSearchParams();

                    if (query.trim()) {
                      params.set("q", query.trim());
                    }

                    const response = await fetch(`/api/mch/stores-options?${params.toString()}`, {
                      method: "GET",
                      cache: "no-store"
                    });

                    if (!response.ok) {
                      throw new Error("Could not load stores.");
                    }

                    const data = (await response.json()) as Array<{ id: string; name: string }>;

                    return data.map((store) => ({
                      id: store.id,
                      label: store.name
                    }));
                  }}
                  disabled={storesLoading}
                  variant="prominent"
                />
              </div>

              <div className="form-row">
                <TimePickerField
                  id="checkInAt"
                  name="checkInAt"
                  label="In"
                  value={draftStartTime}
                  onChange={(value) => {
                    setDraftStartTime(value);

                    if (timeValueToMinutes(value) >= timeValueToMinutes(draftEndTime)) {
                      const nextEndMinutes = Math.min(timeValueToMinutes(value) + 60, 23 * 60 + 59);
                      const nextEndHour = Math.floor(nextEndMinutes / 60);
                      const nextEndMinute = nextEndMinutes % 60;
                      setDraftEndTime(
                        `${String(nextEndHour).padStart(2, "0")}:${String(nextEndMinute).padStart(2, "0")}`
                      );
                    }
                  }}
                  disabled={storesLoading}
                  quickActions={[
                    {
                      label: "Now",
                      minutes: new Date().getHours() * 60 + new Date().getMinutes() - timeValueToMinutes(draftStartTime)
                    }
                  ]}
                />
                <TimePickerField
                  id="checkOutAt"
                  name="checkOutAt"
                  label="Out"
                  value={draftEndTime}
                  onChange={setDraftEndTime}
                  disabled={storesLoading}
                  anchorMinutes={timeValueToMinutes(draftStartTime)}
                  quickActions={[
                    { label: "+30m", minutes: 30 },
                    { label: "+1h", minutes: 60 },
                    { label: "+2h", minutes: 120 }
                  ]}
                />
              </div>

              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={draftNotes}
                  disabled={storesLoading}
                  onChange={(event) => setDraftNotes(event.target.value)}
                />
              </div>

              {state.error ? <p className="form-error">{state.error}</p> : null}

              <div className="actions">
                <button type="submit" disabled={isPending || storesLoading}>
                  {isPending ? "Saving..." : "Save Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
