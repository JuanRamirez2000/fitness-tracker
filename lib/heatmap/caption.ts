import type { DashboardData } from "@/lib/dashboard/types";
import { diffDays } from "@/lib/dates/calendar";
import { isInRange } from "./cell-state";

export interface HeatmapStats {
  /** Days since the program started, counting the start day itself as day 1. */
  elapsed: number;
  /** Weigh-ins and shots within the heatmap's own 53-week window, not all-time. */
  weighIns: number;
  shots: number;
}

export function heatmapStats(data: DashboardData): HeatmapStats {
  const inWindow = (date: string) => isInRange(date, data.heatmap.window);
  return {
    elapsed: diffDays(data.today, data.programStart) + 1,
    weighIns: data.weightTrend.filter((r) => inWindow(r.local_date)).length,
    shots: data.injections.filter((i) => inWindow(i.local_date)).length,
  };
}
