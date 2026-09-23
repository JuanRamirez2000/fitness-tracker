import type { DashboardData } from "@/lib/dashboard/types";
import { progressToGoal } from "@/lib/kpis/progress-to-goal";

export interface ProgressPoint {
  local_date: string;
  changeLb: number;
}

export interface ProgressChartData {
  changedLb: number;
  /** Reuses progress-to-goal's own KPI percentage rather than recomputing one, so the KPI
   * card and this chart card never disagree about how far along the account is. */
  pct: number | null;
  startLb: number;
  goalLb: number | null;
  remainingLb: number | null;
  /** Cumulative change since the very first weigh-in, independent of the selected date range
   * — "progress since start" would be a strange number to have reset by picking "this week". */
  series: ProgressPoint[];
}

export function buildProgress(data: DashboardData): ProgressChartData | null {
  const latest = data.weightTrend.at(-1);
  const start = data.profile.start_weight_lb ?? data.firstWeighIn?.weight_lb ?? null;
  if (!latest || start === null) return null;

  const goal = data.profile.goal_weight_lb;
  const kpi = progressToGoal.compute(data);

  return {
    changedLb: latest.weight_lb - start,
    pct: kpi?.progress ?? null,
    startLb: start,
    goalLb: goal,
    remainingLb: goal !== null ? Math.max(0, latest.weight_lb - goal) : null,
    series: data.weightTrend.map((row) => ({ local_date: row.local_date, changeLb: row.weight_lb - start })),
  };
}
