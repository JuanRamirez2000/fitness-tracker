import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtRaceTime, racePaceSec, RACES } from "@/lib/charts/fitness";
import { fmtPace } from "@/lib/running/runs";

const COMPARE_DAYS = 30;
const SPARKLINE_DAYS = 90;
const FIVE_K_MILES = RACES[0].miles;

/** Garmin's predicted 5K, against a month ago: faster is down, and drawn up. */
export const race5k: KpiDefinition = {
  id: "race-5k",
  label: "5K prediction",
  visual: "sparkline",
  emptyMessage: "No race predictions yet",
  compute(data: DashboardData): KpiValue | null {
    const days = data.training.filter((t) => t.local_date <= data.today && t.race_5k_s !== null);
    const last = days.at(-1);
    if (!last) return null;
    const before = days.filter((t) => t.local_date <= addDays(last.local_date, -COMPARE_DAYS)).at(-1);
    const delta = before ? last.race_5k_s! - before.race_5k_s! : undefined;
    return {
      value: last.race_5k_s,
      unit: "",
      delta,
      tone: delta === undefined ? "neutral" : delta < 0 ? "good" : delta > 0 ? "warn" : "neutral",
      sub: `${fmtPace(racePaceSec(last.race_5k_s!, FIVE_K_MILES))} /mi${before ? " · vs a month ago" : ""}`,
      points: days
        .filter((t) => t.local_date > addDays(last.local_date, -SPARKLINE_DAYS))
        .map((t) => ({ date: t.local_date, value: t.race_5k_s!, text: fmtRaceTime(t.race_5k_s!) })),
      invert: true,
    };
  },
  format(v) {
    const d = v.delta;
    return {
      primary: fmtRaceTime(v.value!),
      delta: d === undefined ? undefined : `${d <= 0 ? "−" : "+"}${fmtRaceTime(Math.abs(d))}`,
      tone: v.tone,
    };
  },
};
