"use client";

import { useState } from "react";
import { openActivity } from "@/components/activity/open";
import { fmtDate } from "@/lib/dates/format";
import type { DashboardData } from "@/lib/dashboard/types";
import { SPORT_NOUN } from "@/lib/sport";
import { activityColumns, buildActivityRows, COLUMN_LABELS, type ActivityColumn, type ActivityRow } from "@/lib/table/activities";

const PAGE_SIZE = 10;
const cellPad = "px-3 py-2 md:px-4";
const NUMERIC = new Set<ActivityColumn>(["mi", "time", "speed", "hr", "power", "cad", "elev"]);
const num = `${cellPad} text-right text-[12.5px] tabular-nums`;

/** The plain cells; date, sport and type are drawn in the row itself. */
function cell(col: ActivityColumn, row: ActivityRow) {
  switch (col) {
    case "mi":
      return <td key={col} className={`${num} text-ink`}>{row.miles}</td>;
    case "time":
      return <td key={col} className={`${num} text-muted-2`}>{row.time}</td>;
    case "speed":
      return <td key={col} className={`${num} whitespace-nowrap text-ink`}>{row.speed ?? "—"}</td>;
    case "hr":
      return <td key={col} className={`${num} text-muted-2`}>{row.avgHr ?? "—"}</td>;
    case "power":
      return <td key={col} className={`${num} text-muted-2`}>{row.power ?? "—"}</td>;
    case "cad":
      return <td key={col} className={`${num} text-muted-2`}>{row.cadence ?? "—"}</td>;
    case "elev":
      return <td key={col} className={`${num} text-muted-2`}>{row.elevFt ?? "—"}</td>;
    case "effect":
      return <td key={col} className={`${cellPad} whitespace-nowrap text-[12px] text-muted-2`}>{row.effect ?? "—"}</td>;
    default:
      return null;
  }
}

/** Rides, runs or both (the sport filter) in the selected range, newest first. Read-only: every row comes from Garmin; a row opens its detail. */
export function ActivitiesTable({ data }: { data: DashboardData }) {
  const rows = buildActivityRows(data);
  const columns = activityColumns(data.sport);
  const title = { ride: "Rides", run: "Runs", all: "Activities" }[data.sport];
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = rows.slice(0, visible);

  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2 md:px-6">
        <span className="font-serif text-[16px]">{title}</span>
        <span className="font-mono text-[10px] text-muted-3">{rows.length} in range</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-divider">
              {columns.map((c) => (
                <th key={c} className={`${cellPad} font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2 ${NUMERIC.has(c) ? "text-right" : ""}`}>
                  {COLUMN_LABELS[c](data.sport)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-[12px] text-muted-2">
                  No {SPORT_NOUN[data.sport].many} in this range.
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr
                key={row.id}
                onClick={() => openActivity(row.id)}
                className="cursor-pointer border-b border-divider/60 hover:bg-raised/40"
                title={[row.name, row.benefit].filter(Boolean).join(" · ")}
              >
                <td className={`${cellPad} whitespace-nowrap text-[12.5px] text-ink`}>
                  {/* The row's click target for keyboards and screen readers; the whole row is clickable with a mouse. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openActivity(row.id);
                    }}
                    className="text-left underline decoration-muted-3 decoration-dotted underline-offset-[3px] hover:decoration-ink"
                    aria-label={`Open ${row.name}, ${fmtDate(row.local_date)}`}
                  >
                    {fmtDate(row.local_date)}
                  </button>
                </td>
                {columns.includes("sport") && (
                  <td className={`${cellPad} whitespace-nowrap text-[12px] text-muted-1`}>
                    <span aria-hidden className="mr-1">{row.sport === "ride" ? "◆" : "●"}</span>
                    {row.sport === "ride" ? "Ride" : "Run"}
                  </td>
                )}
                <td className={`${cellPad} whitespace-nowrap`}>
                  {row.kind ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[1px] font-mono text-[10px] ${
                        row.kind === "workout" ? "border-accent/40 text-accent" : "border-border-strong text-muted-1"
                      }`}
                    >
                      <span aria-hidden>{row.kind === "workout" ? "▲" : "●"}</span>
                      {row.kind === "workout" ? "Workout" : "Easy"}
                    </span>
                  ) : (
                    <span className="text-muted-3">—</span>
                  )}
                </td>
                {columns.map((c) => cell(c, row))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > visible && (
        <div className="flex items-center justify-between px-4 py-2.5 md:px-6">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-3">
            Showing {shown.length} of {rows.length}
          </span>
          <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="text-[11.5px] text-accent hover:underline">
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
