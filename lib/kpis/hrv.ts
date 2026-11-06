import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";

const AVERAGE_NIGHTS = 7;
const SPARKLINE_NIGHTS = 30;

/**
 * Overnight HRV, averaged over the last 7 nights, against Garmin's own normal range: a wide card
 * whose sparkline shows each night over that range.
 */
export const hrv: KpiDefinition = {
  id: "hrv",
  label: "HRV · 7-night average",
  span: 2,
  bandLabel: "Normal range",
  visual: "sparkline",
  emptyMessage: "No overnight HRV yet",
  compute(data: DashboardData): KpiValue | null {
    const nights = data.recovery.filter((r) => r.local_date <= data.today && r.hrv_ms !== null);
    const last = nights.at(-1);
    if (!last) return null;
    const week = nights.filter((r) => r.local_date > addDays(last.local_date, -AVERAGE_NIGHTS));
    const avg = week.reduce((s, r) => s + r.hrv_ms!, 0) / week.length;
    const low = last.hrv_baseline_low;
    const high = last.hrv_baseline_high;
    const where = low === null || high === null ? null : avg < low ? "below" : avg > high ? "above" : "inside";
    const recent = nights.slice(-SPARKLINE_NIGHTS);
    // The band only draws when every night has one; otherwise just the line.
    const banded = recent.every((r) => r.hrv_baseline_low !== null && r.hrv_baseline_high !== null);
    return {
      value: Math.round(avg),
      unit: "ms",
      deltaText: where === null ? undefined : where === "inside" ? "in range" : `${where} range`,
      tone: where === null ? "neutral" : where === "inside" ? "good" : "warn",
      sub: `Last night ${Math.round(last.hrv_ms!)} ms${low !== null && high !== null ? ` · normal ${low}–${high} ms` : ""}`,
      points: recent.map((r) => ({
        date: r.local_date,
        value: r.hrv_ms!,
        text: `${Math.round(r.hrv_ms!)} ms`,
        ...(banded ? { low: r.hrv_baseline_low!, high: r.hrv_baseline_high! } : {}),
      })),
    };
  },
  format(v) {
    return { primary: String(v.value), delta: v.deltaText, tone: v.tone };
  },
};
