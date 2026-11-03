import type { DashboardData } from "@/lib/dashboard/types";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { runsIn, runsOf } from "@/lib/running/runs";

export interface FastestMilePoint {
  dateMs: number;
  local_date: string;
  /** This run's fastest mile split, in seconds. */
  seconds: number;
  /** The fastest mile of any run up to and including this one, all-time. */
  best: number;
}

export interface FastestMileData {
  points: FastestMilePoint[];
  /** Slowest and fastest in range, padded, for the y-axis (seconds). */
  domain: [number, number];
  /** The all-time best and when it happened, which may be before the range. */
  allTimeBest: { seconds: number; local_date: string };
}

/** Each run's fastest mile, with the all-time best as a step line: a new low is a PR. */
export function buildFastestMile(data: DashboardData): FastestMileData | null {
  const runs = runsOf(data.activities).filter((r) => r.fastest_mile_s !== null && r.local_date <= data.dateRange.to);
  if (runs.length === 0) return null;

  let best = Infinity;
  let allTimeBest = { seconds: Infinity, local_date: runs[0].local_date };
  const bestByRun = new Map<string, number>();
  for (const r of runs) {
    if (r.fastest_mile_s! < best) {
      best = r.fastest_mile_s!;
      allTimeBest = { seconds: best, local_date: r.local_date };
    }
    bestByRun.set(r.id, best);
  }

  const points = runsIn(runs, data.dateRange).map((r) => ({
    dateMs: dayStartUtcMs(r.local_date),
    local_date: r.local_date,
    seconds: r.fastest_mile_s!,
    best: bestByRun.get(r.id)!,
  }));
  if (points.length === 0) return null;

  const values = points.flatMap((p) => [p.seconds, p.best]);
  const pad = 15;
  return { points, domain: [Math.max(...values) + pad, Math.min(...values) - pad], allTimeBest };
}
