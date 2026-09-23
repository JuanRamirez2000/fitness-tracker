import type { DashboardData } from "@/lib/dashboard/types";
import { weeklyBuckets } from "./weekly-buckets";

export interface ActivityWeek {
  weekStart: string;
  /** activity_type key -> day count for that week. */
  counts: Record<string, number>;
}

/** Counts DAYS that include a given activity type, not the raw row count — a day with two
 * lifting sessions still counts once, matching the heatmap's own activity mode
 * (lib/heatmap/modes/activity.ts). */
export function buildActivityWeeks(data: DashboardData): ActivityWeek[] {
  const byDate = new Map<string, Set<string>>();
  for (const activity of data.range.activities) {
    const set = byDate.get(activity.local_date) ?? new Set<string>();
    set.add(activity.activity_type);
    byDate.set(activity.local_date, set);
  }

  return weeklyBuckets(data.dateRange).map((days) => {
    const counts: Record<string, number> = {};
    for (const type of data.activityTypes) {
      counts[type.key] = days.filter((d) => byDate.get(d)?.has(type.key)).length;
    }
    return { weekStart: days[0], counts };
  });
}
