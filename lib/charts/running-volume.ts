import type { DashboardData } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { runMiles, runsByDate, runsIn, runsOf } from "@/lib/running/runs";
import { weeklyBuckets } from "./weekly-buckets";

/** Same switch as the steps chart: daily bars up to this many days, weekly totals past it. */
const AGGREGATE_THRESHOLD_DAYS = 45;

export interface RunningVolumeBar {
  /** A day, or a week's first day when aggregated. */
  label: string;
  miles: number;
  runs: number;
}

export interface RunningVolumeData {
  bars: RunningVolumeBar[];
  aggregated: boolean;
  totalMiles: number;
  runCount: number;
}

export function buildRunningVolume(data: DashboardData): RunningVolumeData {
  const runs = runsIn(runsOf(data.activities), data.dateRange);
  const byDate = runsByDate(runs);
  const dayTotal = (d: string) => (byDate.get(d) ?? []).reduce((sum, r) => sum + runMiles(r), 0);
  const days = eachDay(data.dateRange.from, data.dateRange.to);
  const aggregated = days.length > AGGREGATE_THRESHOLD_DAYS;

  const bars: RunningVolumeBar[] = aggregated
    ? weeklyBuckets(data.dateRange).map((week) => ({
        label: week[0],
        miles: week.reduce((sum, d) => sum + dayTotal(d), 0),
        runs: week.reduce((sum, d) => sum + (byDate.get(d)?.length ?? 0), 0),
      }))
    : days.map((d) => ({ label: d, miles: dayTotal(d), runs: byDate.get(d)?.length ?? 0 }));

  return {
    bars,
    aggregated,
    totalMiles: runs.reduce((sum, r) => sum + runMiles(r), 0),
    runCount: runs.length,
  };
}
