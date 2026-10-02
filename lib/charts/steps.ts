import type { DashboardData } from "@/lib/dashboard/types";
import { STEPS_GOAL } from "@/lib/data/steps";
import { eachDay } from "@/lib/dates/calendar";
import { weeklyBuckets } from "./weekly-buckets";

/** Past this many days in range, daily bars would be too thin to read, so the chart switches
 * to one bar per week (that week's daily average). */
const AGGREGATE_THRESHOLD_DAYS = 45;

export interface StepsBar {
  /** A day, or a week's first day when aggregated. */
  label: string;
  steps: number;
  hitGoal: boolean;
}

export interface StepsChartData {
  bars: StepsBar[];
  aggregated: boolean;
  goal: number;
  /** Days in range at or over the goal (always counted per day, even when aggregated). */
  hitCount: number;
}

export function buildSteps(data: DashboardData): StepsChartData {
  const byDate = new Map(data.steps.map((s) => [s.local_date, s.steps] as const));
  const days = eachDay(data.dateRange.from, data.dateRange.to);
  const aggregated = days.length > AGGREGATE_THRESHOLD_DAYS;

  const bars: StepsBar[] = aggregated
    ? weeklyBuckets(data.dateRange).map((week) => {
        const avg = week.reduce((sum, d) => sum + (byDate.get(d) ?? 0), 0) / week.length;
        return { label: week[0], steps: avg, hitGoal: avg >= STEPS_GOAL };
      })
    : days.map((d) => {
        const steps = byDate.get(d) ?? 0;
        return { label: d, steps, hitGoal: steps >= STEPS_GOAL };
      });

  const hitCount = days.filter((d) => (byDate.get(d) ?? 0) >= STEPS_GOAL).length;
  return { bars, aggregated, goal: STEPS_GOAL, hitCount };
}
