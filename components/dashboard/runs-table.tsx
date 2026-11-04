"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/dates/format";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRunRows } from "@/lib/table/runs";

const PAGE_SIZE = 10;
const cellPad = "px-3 py-2 md:px-4";
const HEADERS = ["Date", "Run", "Distance", "Time", "Pace", "Avg HR", "Cadence", "Effect", "Fastest mi"];

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
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-divider">
              {HEADERS.map((h) => (
                <th key={h} className={`${cellPad} font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2`}>
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
              <tr key={row.id} className="border-b border-divider/60 hover:bg-raised/40">
                <td className={`${cellPad} whitespace-nowrap text-[12.5px] text-ink`}>{fmtDate(row.local_date)}</td>
                <td className={`${cellPad} whitespace-nowrap text-[12.5px]`}>
                  <span className="text-ink">{row.name}</span>
                  {row.kind && (
                    <span className={`ml-2 font-mono text-[9.5px] uppercase tracking-[0.06em] ${row.kind === "workout" ? "text-accent" : "text-muted-3"}`}>
                      {row.kind}
                    </span>
                  )}
                </td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-ink`}>{row.miles} mi</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.time}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-ink`}>{row.pace ? `${row.pace}/mi` : "—"}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.avgHr ?? "—"}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.cadence ?? "—"}</td>
                <td className={`${cellPad} whitespace-nowrap text-[12px] text-muted-2`}>{row.effect ?? "—"}</td>
                <td className={`${cellPad} text-right text-[12.5px] tabular-nums text-muted-2`}>{row.fastestMile ?? "—"}</td>
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
