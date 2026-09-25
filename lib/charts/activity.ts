import type { DashboardData } from "@/lib/dashboard/types";
import { weeklyBuckets } from "./weekly-buckets";

export interface ActivityWeek {
  weekStart: string;
  /** activity_type key -> day count for that week. */
  counts: Record<string, number>;
}

const WALK_KEY = "walk";

/** Counts DAYS that include a given activity type, not the raw row count — a day with two
 * lifting sessions still counts once, matching the heatmap's own activity mode
 * (lib/heatmap/modes/activity.ts). Hitting the steps goal counts as a walk too, always —
 * alongside whatever else was logged that day, the same rule the heatmap's Activity mode
 * uses, so the weekly count here never disagrees with what that card shows. */
export function buildActivityWeeks(data: DashboardData): ActivityWeek[] {
  const byDate = new Map<string, Set<string>>();
  for (const activity of data.range.activities) {
    const set = byDate.get(activity.local_date) ?? new Set<string>();
    set.add(activity.activity_type);
    byDate.set(activity.local_date, set);
  }
  const goal = data.profile.steps_goal;
  for (const row of data.range.steps) {
    if (row.value < goal) continue;
    const set = byDate.get(row.local_date) ?? new Set<string>();
    set.add(WALK_KEY);
    byDate.set(row.local_date, set);
  }

  return weeklyBuckets(data.dateRange).map((days) => {
    const counts: Record<string, number> = {};
    for (const type of data.activityTypes) {
      counts[type.key] = days.filter((d) => byDate.get(d)?.has(type.key)).length;
    }
    return { weekStart: days[0], counts };
  });
}
