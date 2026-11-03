import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { runsOf } from "@/lib/running/runs";
import { signed } from "./format";

/** VO2 max moves over months, so the delta compares against roughly a quarter ago. */
const COMPARE_DAYS = 90;
const SPARKLINE_DAYS = 180;

/** Garmin's running VO2 max estimate, as of the latest run that carried one. */
export const vo2max: KpiDefinition = {
  id: "vo2max",
  label: "VO2 max",
  visual: "sparkline",
  emptyMessage: "No VO2 max estimate yet",
  compute(data: DashboardData): KpiValue | null {
    const estimates = runsOf(data.activities).filter((r) => r.vo2max !== null && r.local_date <= data.today);
    const latest = estimates.at(-1);
    if (!latest) return null;

    const compareTo = addDays(data.today, -COMPARE_DAYS);
    const before = estimates.filter((r) => r.local_date <= compareTo).at(-1);
    const sparkFrom = addDays(data.today, -SPARKLINE_DAYS);

    return {
      value: latest.vo2max,
      unit: "",
      delta: before ? latest.vo2max! - before.vo2max! : undefined,
      tone: before && latest.vo2max! > before.vo2max! ? "good" : "neutral",
      sub: `As of ${fmtDate(latest.local_date)}${before ? " · vs 3 months ago" : ""}`,
      series: estimates.filter((r) => r.local_date >= sparkFrom).map((r) => r.vo2max!),
    };
  },
  format(v) {
    return { primary: String(v.value), delta: v.delta === undefined ? undefined : signed(v.delta, 0), tone: v.tone };
  },
};
