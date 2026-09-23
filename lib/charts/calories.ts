import type { TrackingStatus } from "@/lib/data/nutrition-days";
import type { DashboardData } from "@/lib/dashboard/types";
import { caloriesPaint } from "@/lib/heatmap/paints";
import type { Palette } from "@/lib/theme/palette";
import { weeklyBuckets } from "./weekly-buckets";

// Bottom-to-top stacking order, matching the design.
export const CALORIES_STATUSES: readonly TrackingStatus[] = ["accurate", "uncertain", "missed"];

export const CALORIES_STATUS_LABEL: Record<TrackingStatus, string> = {
  accurate: "Accurate",
  uncertain: "May be off",
  missed: "Missed",
};

export interface CaloriesWeek {
  weekStart: string;
  counts: Record<TrackingStatus, number>;
}

/** A day with no nutrition_days row counts toward nothing — the stacked bar is simply
 * shorter for a week with fewer logged days, matching the design (no 4th "not logged"
 * segment is ever drawn). */
export function buildCaloriesWeeks(data: DashboardData): CaloriesWeek[] {
  const byDate = new Map(data.range.nutritionDays.map((d) => [d.local_date, d.tracking_status] as const));
  return weeklyBuckets(data.dateRange).map((days) => {
    const counts: Record<TrackingStatus, number> = { accurate: 0, uncertain: 0, missed: 0 };
    for (const date of days) {
      const status = byDate.get(date);
      if (status) counts[status] += 1;
    }
    return { weekStart: days[0], counts };
  });
}

/** Colors reuse caloriesPaint (lib/heatmap/paints.ts) so the chart's legend never drifts from
 * the heatmap's Calories mode. A function of the active theme's palette, not a static
 * export, since caloriesPaint's fills are real computed hex (used for both an SVG `fill`
 * attribute and a legend swatch style) rather than a `var(--x)` string a CSS-only re-theme
 * could resolve on its own — see lib/theme/palette.ts's paletteFor(). */
export function buildCaloriesLegend(palette: Palette) {
  return CALORIES_STATUSES.map((status) => ({
    status,
    label: CALORIES_STATUS_LABEL[status],
    color: caloriesPaint(status, palette)!.fill,
  }));
}
