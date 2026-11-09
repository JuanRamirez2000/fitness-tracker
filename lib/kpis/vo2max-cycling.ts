import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { signed } from "./format";

const COMPARE_DAYS = 90;
const SPARKLINE_DAYS = 180;

/** Each day Garmin updated cycling VO2 max, oldest first (daily_training, the unofficial import). */
export function cyclingVo2maxSeries(data: Pick<DashboardData, "training" | "today">): { date: string; value: number }[] {
  return data.training
    .filter((t) => t.vo2max_cycling !== null && t.local_date <= data.today)
    .map((t) => ({ date: t.local_date, value: t.vo2max_cycling! }));
}

/** Garmin's cycling VO2 max (it keeps a separate one from rides with power and heart rate). */
export const vo2maxCycling: KpiDefinition = {
  id: "vo2max-cycling",
  label: "Cycling VO2 max",
  visual: "sparkline",
  emptyMessage: "Needs outdoor rides with power",
  compute(data: DashboardData): KpiValue | null {
    const series = cyclingVo2maxSeries(data);
    const latest = series.at(-1);
    if (!latest) return null;
    const before = series.filter((e) => e.date <= addDays(data.today, -COMPARE_DAYS)).at(-1);
    const from = addDays(data.today, -SPARKLINE_DAYS);
    return {
      value: latest.value,
      unit: "",
      delta: before ? latest.value - before.value : undefined,
      tone: before && latest.value > before.value ? "good" : "neutral",
      sub: `As of ${fmtDate(latest.date)}${before ? " · vs 3 months ago" : ""}`,
      points: series.filter((e) => e.date >= from).map((e) => ({ date: e.date, value: e.value, text: e.value.toFixed(1) })),
    };
  },
  format(v) {
    return { primary: v.value!.toFixed(1), delta: v.delta === undefined ? undefined : signed(v.delta, 1), tone: v.tone };
  },
};
