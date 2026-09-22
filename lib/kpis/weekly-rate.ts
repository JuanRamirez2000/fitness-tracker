import type { WeightTrendRow } from "@/lib/data/weight-trend";
import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays, diffDays } from "@/lib/dates/calendar";
import { signed } from "./format";

const SPARKLINE_POINTS = 14;
// "Fewer than 7 days of data = warming up" (the brief), counted from the program start.
const MIN_ELAPSED_DAYS = 7;

/** The row whose local_date is closest to `target`; ties keep the earlier one. */
function nearestRow(rows: readonly WeightTrendRow[], target: string): WeightTrendRow | null {
  let best: WeightTrendRow | null = null;
  let bestGap = Infinity;
  for (const row of rows) {
    const gap = Math.abs(diffDays(row.local_date, target));
    if (gap < bestGap) {
      best = row;
      bestGap = gap;
    }
  }
  return best;
}

export const weeklyRate: KpiDefinition = {
  id: "weekly-rate",
  label: "Weekly rate",
  visual: "sparkline",
  emptyMessage: "Warming up",
  compute(data: DashboardData): KpiValue | null {
    const latest = data.weightTrend.at(-1);
    if (!latest) return null;
    if (diffDays(latest.local_date, data.programStart) < MIN_ELAPSED_DAYS - 1) return null;

    const nearest = nearestRow(data.weightTrend, addDays(latest.local_date, -7));
    if (!nearest || nearest.local_date === latest.local_date) return null;

    const rate = latest.avg7_lb - nearest.avg7_lb;
    return {
      value: rate,
      unit: "lb/wk",
      tone: rate < 0 ? "good" : "neutral",
      sub: "From the 7-day average",
      series: data.weightTrend.slice(-SPARKLINE_POINTS).map((row) => row.avg7_lb),
    };
  },
  format(v) {
    return { primary: signed(v.value!), tone: v.tone };
  },
};
