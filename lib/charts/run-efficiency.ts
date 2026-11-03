import type { DashboardData } from "@/lib/dashboard/types";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { easyPaceAtRefHr, median, runsIn, runsOf } from "@/lib/running/runs";

/** The trend line is the median of each run and the ones before it, so one off day can't
 * swing it. */
const TREND_RUNS = 5;

export interface RunEfficiencyPoint {
  dateMs: number;
  local_date: string;
  /** Seconds per mile, scaled to 130 bpm. */
  pace: number;
  avgHr: number;
  /** The rolling median, in seconds per mile. */
  trend: number;
}

export interface RunEfficiencyData {
  points: RunEfficiencyPoint[];
  /** Slowest and fastest pace in range, padded, for the y-axis (seconds per mile). */
  paceDomain: [number, number];
  /** Last trend value minus the first: negative means faster at the same heart rate. */
  changeSec: number | null;
}

export function buildRunEfficiency(data: DashboardData): RunEfficiencyData | null {
  const runs = runsOf(data.activities);
  // The rolling median looks back past the range's start, so its first points aren't
  // built from a single run.
  const scored = runs
    .filter((r) => r.local_date <= data.dateRange.to)
    .map((r) => ({ run: r, pace: easyPaceAtRefHr(r) }))
    .filter((s): s is { run: (typeof runs)[number]; pace: number } => s.pace !== null);
  const inRange = new Set(runsIn(runs, data.dateRange).map((r) => r.id));

  const points: RunEfficiencyPoint[] = [];
  scored.forEach((s, i) => {
    if (!inRange.has(s.run.id)) return;
    const window = scored.slice(Math.max(0, i - TREND_RUNS + 1), i + 1).map((w) => w.pace);
    points.push({
      dateMs: dayStartUtcMs(s.run.local_date),
      local_date: s.run.local_date,
      pace: s.pace,
      avgHr: s.run.avg_hr!,
      trend: median(window)!,
    });
  });
  if (points.length === 0) return null;

  const paces = points.flatMap((p) => [p.pace, p.trend]);
  const pad = 15;
  return {
    points,
    paceDomain: [Math.max(...paces) + pad, Math.min(...paces) - pad],
    changeSec: points.length >= 2 ? points.at(-1)!.trend - points[0].trend : null,
  };
}
