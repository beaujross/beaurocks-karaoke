import React, { useMemo } from "react";
import { normalizeCadenceRows } from "./cadenceSchedule";

const WeeklyScheduleEditor = ({ value = [], onChange }) => {
  const rows = useMemo(() => normalizeCadenceRows(value), [value]);

  const updateRows = (nextRows = []) => {
    onChange?.(normalizeCadenceRows(nextRows));
  };

  const updateRow = (key = "", patch = {}) => {
    const next = rows.map((row) => (row.key === key ? { ...row, ...patch } : row));
    updateRows(next);
  };

  return (
    <div className="mk3-weekly-editor">
      <div className="mk3-weekly-head">
        <span>Day</span>
        <span>Start</span>
        <span>End</span>
      </div>
      {rows.map((row) => (
        <div key={row.key} className="mk3-weekly-row">
          <label className="mk3-weekly-day">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(event) => {
                const enabled = !!event.target.checked;
                updateRow(row.key, {
                  enabled,
                  startTime: enabled ? row.startTime : "",
                  endTime: enabled ? row.endTime : "",
                });
              }}
            />
            <span>{row.label}</span>
          </label>
          <input
            type="time"
            value={row.startTime}
            disabled={!row.enabled}
            onChange={(event) => updateRow(row.key, { startTime: event.target.value })}
          />
          <input
            type="time"
            value={row.endTime}
            disabled={!row.enabled}
            onChange={(event) => updateRow(row.key, { endTime: event.target.value })}
          />
        </div>
      ))}
      <div className="mk3-weekly-actions">
        <button
          type="button"
          onClick={() => updateRows(rows.map((row) => ({
            ...row,
            enabled: false,
            startTime: "",
            endTime: "",
          })))}
        >
          Clear Schedule
        </button>
      </div>
    </div>
  );
};

export default WeeklyScheduleEditor;
