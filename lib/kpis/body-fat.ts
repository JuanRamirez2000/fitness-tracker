import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { signed } from "./format";

const COMPARE_DAYS = 30;
const SPARKLINE_READINGS = 30;

/** The scale's latest body fat percentage, against a month before: down is the point. */
export const bodyFat: KpiDefinition = {
  id: "body-fat",
  label: "Body fat",
  visual: "sparkline",
  emptyMessage: "No body fat readings yet",
  compute(data: DashboardData): KpiValue | null {
    const days = data.bodyComposition.filter((d) => d.local_date <= data.today && d.body_fat_pct !== null);
    const last = days.at(-1);
    if (!last) return null;
    const before = days.filter((d) => d.local_date <= addDays(last.local_date, -COMPARE_DAYS)).at(-1);
    const delta = before ? last.body_fat_pct! - before.body_fat_pct! : undefined;
    return {
      value: last.body_fat_pct,
      unit: "%",
      delta,
      tone: delta === undefined ? "neutral" : delta < 0 ? "good" : delta > 0.5 ? "warn" : "neutral",
      sub: `${fmtDate(last.local_date)}${before ? ` · vs ${fmtDate(before.local_date)}` : ""} · scale reading`,
      points: days.slice(-SPARKLINE_READINGS).map((d) => ({ date: d.local_date, value: d.body_fat_pct!, text: `${d.body_fat_pct!.toFixed(1)}%` })),
    };
  },
  format(v) {
    return { primary: v.value!.toFixed(1), delta: v.delta === undefined ? undefined : `${signed(v.delta)} pts`, tone: v.tone };
  },
};
