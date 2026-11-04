"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/dates/format";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRunRows } from "@/lib/table/runs";

const PAGE_SIZE = 10;
const cellPad = "px-3 py-2 md:px-4";
const HEADERS = ["Date", "Type", "Mi", "Time", "Pace", "HR", "Cad", "Effect"];
const NUMERIC = new Set(["Mi", "Time", "Pace", "HR", "Cad"]);

/** Runs in the selected range, newest first. Read-only: every row comes from Garmin. */
export function RunsTable({ data }: { data: DashboardData }) {
  const rows = buildRunRows(data);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = rows.slice(0, visible);

  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2 md:px-6">
        <span className="font-serif text-[16px]">Runs</span>
        <span className="font-mono text-[10px] text-muted-3">{rows.length} in range</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-divider">
              {HEADERS.map((h) => (
                <th key={h} className={`${cellPad} font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2 ${NUMERIC.has(h) ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-6 text-center text-[12px] text-muted-2">
                  No runs in this range.
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr key={row.id} className="border-b border-divider/60 hover:bg-raised/40" title={[row.name, row.benefit].filter(Boolean).join(" · ")}>
                <td className={`${cellPad} whitespace-nowrap text-[12.5px] text-ink`}>{fmtDate(row.local_date)}</td>
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
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-ink`}>{row.miles}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.time}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-ink`}>{row.pace ? `${row.pace}/mi` : "—"}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.avgHr ?? "—"}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.cadence ?? "—"}</td>
                <td className={`${cellPad} whitespace-nowrap text-[12px] text-muted-2`}>{row.effect ?? "—"}</td>
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
