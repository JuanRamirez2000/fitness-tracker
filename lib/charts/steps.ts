import type { DashboardData } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { weeklyBuckets } from "./weekly-buckets";

/** Past this many days in range, daily bars would be too thin to read — switch to a weekly
 * average, matching the design's own stepAgg threshold. */
const AGGREGATE_THRESHOLD_DAYS = 45;

export interface StepsBar {
  /** A day, or a week's start day when aggregated. */
  label: string;
  steps: number;
  hitGoal: boolean;
}

export interface StepsChartData {
  bars: StepsBar[];
  aggregated: boolean;
  /** The account's real steps_goal, not the design mockup's hardcoded 10k — matches how
   * lib/heatmap/paints.ts's stepsPaint and the Steps-today KPI already use this field. */
  goal: number;
  hitCount: number;
}

export function buildSteps(data: DashboardData): StepsChartData {
  const byDate = new Map(data.range.steps.map((s) => [s.local_date, s.value] as const));
  const days = eachDay(data.dateRange.from, data.dateRange.to);
  const goal = data.profile.steps_goal;
  const aggregated = days.length > AGGREGATE_THRESHOLD_DAYS;

  const bars: StepsBar[] = aggregated
    ? weeklyBuckets(data.dateRange).map((week) => {
        const values = week.map((d) => byDate.get(d) ?? 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { label: week[0], steps: avg, hitGoal: avg >= goal };
      })
    : days.map((d) => {
        const steps = byDate.get(d) ?? 0;
        return { label: d, steps, hitGoal: steps >= goal };
      });

  const hitCount = days.filter((d) => (byDate.get(d) ?? 0) >= goal).length;

  return { bars, aggregated, goal, hitCount };
}
