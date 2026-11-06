import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { signed } from "./format";

const BASELINE_DAYS = 30;

/** This morning's resting heart rate against its 30-day average: lower is better. */
export const restingHr: KpiDefinition = {
  id: "resting-hr",
  label: "Resting HR",
  visual: "sparkline",
  emptyMessage: "No resting heart rate yet",
  compute(data: DashboardData): KpiValue | null {
    const days = data.recovery.filter((r) => r.local_date <= data.today && r.resting_hr !== null);
    const last = days.at(-1);
    if (!last) return null;
    const month = days.filter((r) => r.local_date < last.local_date && r.local_date >= addDays(last.local_date, -BASELINE_DAYS));
    const avg = month.length ? month.reduce((s, r) => s + r.resting_hr!, 0) / month.length : null;
    const delta = avg === null ? undefined : last.resting_hr! - avg;
    return {
      value: last.resting_hr,
      unit: "bpm",
      delta,
      // A couple of beats above normal is worth a look; below it is good.
      tone: delta === undefined ? "neutral" : delta <= -1 ? "good" : delta >= 3 ? "warn" : "neutral",
      sub: avg === null ? "This morning" : `vs ${Math.round(avg)} bpm, the 30-day average`,
      points: days.slice(-BASELINE_DAYS).map((r) => ({ date: r.local_date, value: r.resting_hr!, text: `${r.resting_hr} bpm` })),
    };
  },
  format(v) {
    return { primary: String(v.value), delta: v.delta === undefined ? undefined : signed(v.delta, 0), tone: v.tone };
  },
};
