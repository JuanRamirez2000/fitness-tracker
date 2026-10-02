import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { STEPS_GOAL } from "@/lib/data/steps";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { clamp } from "./format";

/** Today's steps, or the most recent synced day's: Garmin syncs nightly, so during the day
 * the latest row is often yesterday's. The caption says which day it is. */
export const stepsToday: KpiDefinition = {
  id: "steps-today",
  label: "Steps",
  visual: "progress",
  emptyMessage: "No steps synced yet",
  compute(data: DashboardData): KpiValue | null {
    const latest = data.heatmap.steps.filter((s) => s.local_date <= data.today).at(-1);
    if (!latest) return null;

    const hit = latest.steps >= STEPS_GOAL;
    const day =
      latest.local_date === data.today ? "Today" : latest.local_date === addDays(data.today, -1) ? "Yesterday" : fmtDate(latest.local_date);
    return {
      value: latest.steps,
      unit: "",
      tone: hit ? "good" : "neutral",
      deltaText: hit ? "10k hit" : `${((STEPS_GOAL - latest.steps) / 1000).toFixed(1)}k to go`,
      sub: `${day} · goal ${STEPS_GOAL.toLocaleString("en-US")}`,
      progress: clamp(latest.steps / STEPS_GOAL, 0, 1),
    };
  },
  format(v) {
    return { primary: v.value!.toLocaleString("en-US"), delta: v.deltaText, tone: v.tone };
  },
};
