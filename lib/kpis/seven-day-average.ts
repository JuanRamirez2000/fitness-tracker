import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { MIN_AVG7_SAMPLES } from "@/lib/data/weight-trend";
import { signed } from "./format";

const SPARKLINE_POINTS = 21;

export const sevenDayAverage: KpiDefinition = {
  id: "seven-day-average",
  label: "7-day average",
  visual: "sparkline",
  emptyMessage: "No data yet",
  compute(data: DashboardData): KpiValue | null {
    const today = data.weightTrend.find((row) => row.local_date === data.today);
    if (!today) return null;

    // n7 < MIN_AVG7_SAMPLES ("warming up", see schema.sql) still has a real average to show —
    // just a noisier one — so this stays a value with a caption, not an empty state.
    const warmingUp = today.n7 < MIN_AVG7_SAMPLES;
    const delta = warmingUp ? undefined : (today.avg7_delta_lb ?? undefined);

    return {
      value: today.avg7_lb,
      unit: "lb",
      delta,
      deltaUnit: "lb",
      tone: delta === undefined ? "neutral" : delta <= 0 ? "good" : "bad",
      sub: warmingUp ? `Still warming up (${today.n7} of ${MIN_AVG7_SAMPLES} days)` : "Smoothed line on the trend chart",
      series: data.weightTrend.slice(-SPARKLINE_POINTS).map((row) => row.avg7_lb),
    };
  },
  format(v) {
    return {
      primary: v.value!.toFixed(1),
      delta: v.delta !== undefined ? `${signed(v.delta)} ${v.deltaUnit}` : undefined,
      tone: v.tone,
    };
  },
};
