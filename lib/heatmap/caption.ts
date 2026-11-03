import type { DashboardData } from "@/lib/dashboard/types";
import { STEPS_GOAL } from "@/lib/data/steps";
import { diffDays } from "@/lib/dates/calendar";
import { runsOf, totalMiles } from "@/lib/running/runs";
import { isInRange } from "./cell-state";

export interface HeatmapStats {
  /** Days since the program started, counting the start day itself as day 1. */
  elapsed: number;
  /** Weigh-ins and shots within the heatmap's own 53-week window, not all-time. */
  weighIns: number;
  shots: number;
  /** In-program days in the window with steps synced, and how many of those reached 10k. */
  stepDays: number;
  stepDaysOverGoal: number;
  /** Runs since the program started, and their total distance in miles. */
  runs: number;
  runMiles: number;
}

export function heatmapStats(data: DashboardData): HeatmapStats {
  const inWindow = (date: string) => isInRange(date, data.heatmap.window);
  const programSteps = data.heatmap.steps.filter((s) => s.local_date >= data.programStart && s.local_date <= data.today);
  const programRuns = runsOf(data.activities).filter((r) => r.local_date >= data.programStart && r.local_date <= data.today);
  return {
    elapsed: diffDays(data.today, data.programStart) + 1,
    weighIns: data.weightTrend.filter((r) => inWindow(r.local_date)).length,
    shots: data.injections.filter((i) => inWindow(i.local_date)).length,
    stepDays: programSteps.length,
    stepDaysOverGoal: programSteps.filter((s) => s.steps >= STEPS_GOAL).length,
    runs: programRuns.length,
    runMiles: totalMiles(programRuns),
  };
}
