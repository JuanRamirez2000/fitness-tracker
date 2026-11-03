import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { runMiles, runsIn, runsOf, totalMiles } from "@/lib/running/runs";
import { signed } from "./format";

const SPARKLINE_WEEKS = 8;

/** Trailing 7 days ending `end`, inclusive. */
function week(end: string) {
  return { from: addDays(end, -6), to: end };
}

/** Miles run in the last 7 days, against the 7 before; the sparkline is the last 8 weeks. */
export const weeklyMiles: KpiDefinition = {
  id: "weekly-miles",
  label: "Run miles",
  visual: "sparkline",
  emptyMessage: "No runs synced yet",
  compute(data: DashboardData): KpiValue | null {
    const runs = runsOf(data.activities);
    if (runs.length === 0) return null;

    const thisWeek = runsIn(runs, week(data.today));
    const miles = totalMiles(thisWeek);
    const previous = totalMiles(runsIn(runs, week(addDays(data.today, -7))));
    const longest = Math.max(0, ...thisWeek.map(runMiles));
    const series = Array.from({ length: SPARKLINE_WEEKS }, (_, i) =>
      totalMiles(runsIn(runs, week(addDays(data.today, -7 * (SPARKLINE_WEEKS - 1 - i))))),
    );

    return {
      value: miles,
      unit: "mi",
      delta: miles - previous,
      tone: miles >= previous ? "good" : "neutral",
      sub:
        thisWeek.length === 0
          ? "No runs in the last 7 days"
          : `Last 7 days · ${thisWeek.length} run${thisWeek.length === 1 ? "" : "s"} · longest ${longest.toFixed(1)} mi`,
      series,
    };
  },
  format(v) {
    return { primary: v.value!.toFixed(1), delta: `${signed(v.delta!)} mi`, tone: v.tone };
  },
};
