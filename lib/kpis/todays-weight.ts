import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { fmtDate } from "@/lib/dates/format";
import { signed } from "./format";

// Recent recorded days shown on the sparkline, not calendar days.
const SPARKLINE_POINTS = 30;

export const todaysWeight: KpiDefinition = {
  id: "todays-weight",
  label: "Today's weight",
  visual: "sparkline",
  emptyMessage: "Log today's weight",
  compute(data: DashboardData): KpiValue | null {
    const today = data.weightTrend.find((row) => row.local_date === data.today);
    if (!today) return null;

    const delta = today.raw_delta_lb ?? undefined;
    return {
      value: today.weight_lb,
      unit: "lb",
      delta,
      deltaUnit: "lb",
      tone: delta === undefined ? "neutral" : delta <= 0 ? "good" : "bad",
      sub: `Logged ${fmtDate(today.local_date)}`,
      series: data.weightTrend.slice(-SPARKLINE_POINTS).map((row) => row.weight_lb),
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
