import type { DashboardData } from "@/lib/dashboard/types";
import { weeklyBuckets } from "./weekly-buckets";

export interface WeeklyRatePoint {
  weekStart: string;
  /** lb change vs. the previous week's average weight; positive means the week gained. */
  rate: number;
}

/** One bar per week that has a weigh-in AND a previous week with one to compare against, so
 * the first bar is always a week-over-week delta, never a lone absolute value. */
export function buildWeeklyRate(data: DashboardData): WeeklyRatePoint[] {
  const byDate = new Map(data.weightTrend.map((r) => [r.local_date, r.weight_lb] as const));

  const weekAvgs = weeklyBuckets(data.dateRange)
    .map((days) => {
      const weights = days.map((d) => byDate.get(d)).filter((w): w is number => w !== undefined);
      return weights.length ? { weekStart: days[0], avg: weights.reduce((a, b) => a + b, 0) / weights.length } : null;
    })
    .filter((w): w is { weekStart: string; avg: number } => w !== null);

  return weekAvgs.slice(1).map((w, i) => ({ weekStart: w.weekStart, rate: w.avg - weekAvgs[i].avg }));
}
