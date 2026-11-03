import type { DashboardData, RangeKey } from "@/lib/dashboard/types";
import { resolveRange } from "@/lib/range/resolve";
import { buildWeightTrend, type WeightTrendChartData } from "./weight-trend";

/** The fixed windows shown side by side under the main weight chart, independent of the
 * page's own RangeControl so all three trends read at a glance. */
export const TREND_WINDOW_KEYS = ["month", "6m", "year"] as const satisfies readonly RangeKey[];
export type TrendWindowKey = (typeof TREND_WINDOW_KEYS)[number];

export interface TrendWindow {
  key: TrendWindowKey;
  chart: WeightTrendChartData | null;
  /** Last 7-day average minus the first one inside the window; null with fewer than two days. */
  changeLb: number | null;
}

export function buildTrendWindows(data: DashboardData): TrendWindow[] {
  return TREND_WINDOW_KEYS.map((key) => {
    const dateRange = resolveRange(key, data.today, data.programStart);
    const chart = buildWeightTrend({ ...data, dateRange });
    const points = chart?.points ?? [];
    const changeLb = points.length >= 2 ? points[points.length - 1].avg7 - points[0].avg7 : null;
    return { key, chart, changeLb };
  });
}
