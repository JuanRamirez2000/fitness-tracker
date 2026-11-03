import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { EFFICIENCY_REF_HR, easyPaceAtRefHr, fmtPace, median, runsIn, runsOf } from "@/lib/running/runs";

/** A month of easy runs smooths out one hot day or a bad night's sleep. */
const WINDOW_DAYS = 28;
const SPARKLINE_RUNS = 12;

/**
 * The median easy-run pace scaled to 130 bpm over the last 4 weeks, against the 4 before:
 * the clearest week-to-week sign of aerobic fitness. A negative delta (faster) is good.
 */
export const easyPace: KpiDefinition = {
  id: "easy-pace",
  label: `Easy pace @ ${EFFICIENCY_REF_HR}`,
  visual: "sparkline",
  emptyMessage: "No easy runs with heart rate yet",
  compute(data: DashboardData): KpiValue | null {
    const runs = runsOf(data.activities);
    const paces = (from: string, to: string) =>
      runsIn(runs, { from, to })
        .map(easyPaceAtRefHr)
        .filter((p): p is number => p !== null);

    const recent = paces(addDays(data.today, -(WINDOW_DAYS - 1)), data.today);
    const current = median(recent);
    if (current === null) return null;
    const before = median(paces(addDays(data.today, -(2 * WINDOW_DAYS - 1)), addDays(data.today, -WINDOW_DAYS)));
    const series = runs
      .map(easyPaceAtRefHr)
      .filter((p): p is number => p !== null)
      .slice(-SPARKLINE_RUNS)
      // Sparklines draw higher values higher; negate so a faster pace points up.
      .map((p) => -p);

    return {
      value: current,
      unit: "/mi",
      delta: before === null ? undefined : current - before,
      tone: before !== null && current < before ? "good" : "neutral",
      sub: `${recent.length} easy run${recent.length === 1 ? "" : "s"} near ${EFFICIENCY_REF_HR} bpm in 4 weeks, scaled to it`,
      series,
    };
  },
  format(v) {
    const delta = v.delta === undefined ? undefined : `${v.delta <= 0 ? "−" : "+"}${fmtPace(Math.abs(v.delta))}`;
    return { primary: fmtPace(v.value!), delta, tone: v.tone };
  },
};
