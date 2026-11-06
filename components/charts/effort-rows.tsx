"use client";

import { scaleLinear } from "@visx/scale";
import { openActivity } from "@/components/activity/open";
import type { BestEffort, EffortMark } from "@/lib/charts/best-efforts";
import { fmtRaceTime } from "@/lib/charts/fitness";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartHover, type HoverPoint } from "./chart-hover";

const SPARK_W = 120;
const SPARK_H = 28;

function fmtValue(e: BestEffort, v: number): string {
  if (e.unit === "time") return fmtRaceTime(v);
  if (e.unit === "miles") return `${v.toFixed(2)} mi`;
  return v >= 3600 ? fmtRaceTime(v) : `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
}

/** "−0:12 off best", "0.4 mi short of best": how far a range's best sits from the record. */
function offBest(e: BestEffort, m: EffortMark): string {
  const gap = Math.abs(m.value - e.best.value);
  if (e.unit === "miles") return `${gap.toFixed(2)} mi short`;
  return `${fmtValue(e, gap)} ${e.better === "lower" ? "slower" : "short"}`;
}

/** The record's history as a step line: flat until it falls (or rises), out to today. */
function RecordSteps({ e, today }: { e: BestEffort; today: string }) {
  const first = dayStartUtcMs(e.records[0].date);
  const last = Math.max(dayStartUtcMs(today), first + 1);
  const x = scaleLinear<number>({ domain: [first, last], range: [3, SPARK_W - 3] });
  const values = e.records.map((r) => r.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Better is up: for times, a lower value draws higher.
  const y = scaleLinear<number>({ domain: hi === lo ? [lo - 1, hi + 1] : [lo, hi], range: e.better === "lower" ? [4, SPARK_H - 4] : [SPARK_H - 4, 4] });
  let d = "";
  e.records.forEach((r, i) => {
    const px = x(dayStartUtcMs(r.date));
    d += i === 0 ? `M${px} ${y(r.value)}` : ` H${px} V${y(r.value)}`;
  });
  d += ` H${x(last)}`;
  const points: HoverPoint[] = e.records.map((r, i) => ({
    at: x(dayStartUtcMs(r.date)) / SPARK_W,
    title: fmtPointTitle(r.date),
    rows: [
      { label: i === 0 ? "First" : "New record", value: fmtValue(e, r.value), swatch: { shape: "line", className: "bg-accent" } },
      { label: "Run", value: r.name, muted: true },
    ],
    marks: [{ y: y(r.value) / SPARK_H, className: "bg-accent" }],
    activityId: r.activityId,
  }));
  return (
    <ChartHover points={points} label={`${e.label} records`} className="w-[120px] shrink-0">
      <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="block" aria-hidden>
        <path d={d} className="fill-none stroke-accent" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </ChartHover>
  );
}

/** One row per effort; the label and value open the record run. */
export function EffortRows({ efforts, today }: { efforts: BestEffort[]; today: string }) {
  return (
    <ul className="flex flex-col divide-y divide-divider/60">
      {efforts.map((e) => {
        // The record was set inside the range.
        const newBest = e.inRange !== null && e.inRange.activityId === e.best.activityId && e.inRange.date === e.best.date;
        return (
          <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <button
              type="button"
              onClick={() => openActivity(e.best.activityId)}
              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
              aria-label={`${e.label}: ${fmtValue(e, e.best.value)} on ${fmtDate(e.best.date)}. Open the run.`}
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{e.label}</span>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[18px] leading-tight text-ink">{fmtValue(e, e.best.value)}</span>
                <span className="truncate text-[11px] text-muted-2 hover:text-ink">
                  {fmtDate(e.best.date)} · {e.best.name}
                </span>
              </span>
              <span className="font-mono text-[10px] text-muted-2">
                {e.inRange === null ? (
                  "none in this range"
                ) : newBest ? (
                  <span className="text-good">▲ new best in this range</span>
                ) : (
                  <>
                    this range {fmtValue(e, e.inRange.value)} · {offBest(e, e.inRange)}
                  </>
                )}
              </span>
            </button>
            {e.records.length > 1 ? <RecordSteps e={e} today={today} /> : <span className="w-[120px] shrink-0 text-right font-mono text-[9.5px] text-muted-3">one run so far</span>}
          </li>
        );
      })}
    </ul>
  );
}
