"use client";

import { useMemo } from "react";

type TimePickerFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  quickActions?: Array<{
    label: string;
    minutes: number;
  }>;
  anchorMinutes?: number;
};

const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function parseTimeValue(value: string) {
  const [rawHour = "09", rawMinute = "00"] = value.split(":");
  const hour24 = Number(rawHour);
  const minute = rawMinute.padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return {
    hour: String(hour12),
    minute,
    period
  };
}

function buildTimeValue(hour: string, minute: string, period: string) {
  const parsedHour = Number(hour) % 12;
  const hour24 = period === "PM" ? parsedHour + 12 : parsedHour;
  const normalizedHour = parsedHour === 0 && period === "AM" ? 0 : hour24;

  return `${String(normalizedHour).padStart(2, "0")}:${minute}`;
}

function formatTimeLabel(value: string) {
  return new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeMinutes(minutes: number) {
  return Math.max(0, Math.min(minutes, 23 * 60 + 59));
}

function minutesToTimeValue(minutes: number) {
  const safeMinutes = normalizeMinutes(minutes);
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePickerField({
  id,
  name,
  label,
  value,
  onChange,
  disabled = false,
  quickActions = [],
  anchorMinutes
}: TimePickerFieldProps) {
  const parts = useMemo(() => parseTimeValue(value), [value]);

  return (
    <div className="field">
      <label htmlFor={`${id}-hour`}>{label}</label>
      <input id={id} name={name} type="hidden" value={value} />

      <div className="time-picker">
        <div className="time-picker-controls">
          <select
            id={`${id}-hour`}
            value={parts.hour}
            disabled={disabled}
            onChange={(event) => onChange(buildTimeValue(event.target.value, parts.minute, parts.period))}
          >
            {hourOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <span className="time-picker-separator">:</span>

          <select
            value={parts.minute}
            disabled={disabled}
            onChange={(event) => onChange(buildTimeValue(parts.hour, event.target.value, parts.period))}
          >
            {minuteOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="time-picker-period">
            {["AM", "PM"].map((period) => (
              <button
                key={period}
                type="button"
                className={`time-picker-period-button${parts.period === period ? " time-picker-period-button-active" : ""}`}
                disabled={disabled}
                onClick={() => onChange(buildTimeValue(parts.hour, parts.minute, period))}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="time-picker-footer">
          <span className="time-picker-label">{formatTimeLabel(value)}</span>
          {quickActions.length > 0 ? (
            <div className="time-picker-quick-actions">
              {quickActions.map((action) => {
                const baseMinutes =
                  typeof anchorMinutes === "number"
                    ? anchorMinutes
                    : Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

                return (
                  <button
                    key={action.label}
                    type="button"
                    className="button secondary time-chip"
                    disabled={disabled}
                    onClick={() => onChange(minutesToTimeValue(baseMinutes + action.minutes))}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
