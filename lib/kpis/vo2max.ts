import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { runsOf } from "@/lib/running/runs";
import { signed } from "./format";

/** VO2 max moves over months, so the delta compares against roughly a quarter ago. */
const COMPARE_DAYS = 90;
const SPARKLINE_DAYS = 180;

/**
 * Each day's VO2 max, oldest first: Garmin's daily value (daily_training, the unofficial
 * import) where there is one, else the estimate a run carried (older imports; the Personal
 * API's activities have none).
 */
export function vo2maxSeries(data: Pick<DashboardData, "activities" | "training" | "today">): { date: string; value: number }[] {
  const byDate = new Map<string, number>();
  for (const r of runsOf(data.activities)) if (r.vo2max !== null) byDate.set(r.local_date, r.vo2max);
  for (const t of data.training) if (t.vo2max !== null) byDate.set(t.local_date, t.vo2max);
  return [...byDate.entries()]
    .filter(([date]) => date <= data.today)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

/** Garmin's running VO2 max, as of its latest update. */
export const vo2max: KpiDefinition = {
  id: "vo2max",
  label: "Running VO2 max",
  visual: "sparkline",
  emptyMessage: "No VO2 max estimate yet",
  compute(data: DashboardData): KpiValue | null {
    const estimates = vo2maxSeries(data);
    const latest = estimates.at(-1);
    if (!latest) return null;

    const compareTo = addDays(data.today, -COMPARE_DAYS);
    const before = estimates.filter((e) => e.date <= compareTo).at(-1);
    const sparkFrom = addDays(data.today, -SPARKLINE_DAYS);

    return {
      value: latest.value,
      unit: "",
      delta: before ? latest.value - before.value : undefined,
      tone: before && latest.value > before.value ? "good" : "neutral",
      sub: `As of ${fmtDate(latest.date)}${before ? " · vs 3 months ago" : ""}`,
      points: estimates.filter((e) => e.date >= sparkFrom).map((e) => ({ date: e.date, value: e.value, text: e.value.toFixed(Number.isInteger(e.value) ? 0 : 1) })),
    };
  },
  format(v) {
    // Garmin's daily value has one decimal (42.2); older run estimates were whole numbers.
    const digits = Number.isInteger(v.value) ? 0 : 1;
    return {
      primary: v.value === null ? "" : v.value.toFixed(digits),
      delta: v.delta === undefined ? undefined : signed(v.delta, Number.isInteger(v.delta) ? 0 : 1),
      tone: v.tone,
    };
  },
};
