"use client";

import { openActivity } from "@/components/activity/open";
import { fmtDate, weekdayName } from "@/lib/dates/format";
import type { DayRow } from "@/lib/log/days";
import { SPORT_STYLE, type ActiveSport } from "@/lib/sport";

const GLYPH_TONE: Record<ActiveSport, string> = { ride: "text-sport-ride", run: "text-sport-run", swim: "text-sport-swim" };
const dash = <span className="text-muted-3">–</span>;
const n = (v: number | null, f: (x: number) => string = String) => (v === null ? dash : f(v));

/**
 * Every day in the range, newest first, with every daily number the app has: weight, readiness,
 * sleep, HRV, resting HR, steps, Body Battery at wake, mood, the day's activities (click one to
 * open it) and load, and planned sessions done. Scrolls sideways inside its card on a phone.
 */
export function DayTable({ days }: { days: DayRow[] }) {
  const rows = [...days].reverse();
  return (
    <div data-toc="Every day" className="flex min-w-0 scroll-mt-28 flex-col rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-[3px] px-4 pt-4 pb-2 md:px-6">
        <span className="font-serif text-[16px] md:text-[18px]">Every day</span>
        <span className="text-[12px] text-muted-2">Each day&apos;s numbers in this range, newest first</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse font-mono text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-[9.5px] uppercase tracking-[0.08em] text-muted-2">
              {["Day", "Weight", "Readiness", "Sleep", "Hours", "HRV", "Rest HR", "Steps", "Battery", "Mood", "Activities", "Load", "Plan"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal first:pl-4 md:first:pl-6">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.date} id={`day-${d.date}`} className="scroll-mt-32 border-b border-border/60 align-top target:bg-accent/10 last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-ink first:pl-4 md:first:pl-6">
                  {weekdayName(d.date).slice(0, 3)} {fmtDate(d.date)}
                </td>
                <td className="px-3 py-2 text-muted-1">{n(d.weightLb, (v) => v.toFixed(1))}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.readiness)}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.sleepScore)}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.sleepHours, (v) => v.toFixed(1))}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.hrvMs)}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.restingHr)}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.steps, (v) => v.toLocaleString("en-US"))}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.batteryWake)}</td>
                <td className="px-3 py-2 text-muted-1">{n(d.mood, (v) => `${v}/5`)}</td>
                <td className="px-3 py-2">
                  {d.activities.length ? (
                    <span className="flex flex-col gap-0.5">
                      {d.activities.map((a) => (
                        <button key={a.id} type="button" onClick={() => openActivity(a.id)} className="flex items-center gap-1.5 text-left text-ink hover:text-accent">
                          {a.sport && <span className={GLYPH_TONE[a.sport]}>{SPORT_STYLE[a.sport].glyph}</span>}
                          <span className="max-w-[180px] truncate font-sans text-[12px]">{a.name}</span>
                          <span className="text-muted-2">{a.minutes}m</span>
                        </button>
                      ))}
                    </span>
                  ) : (
                    dash
                  )}
                </td>
                <td className="px-3 py-2 text-muted-1">{n(d.load)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-1">{d.planned ? `${d.plannedDone}/${d.planned}` : dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
