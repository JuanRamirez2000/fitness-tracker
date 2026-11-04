import { easyPace } from "@/lib/kpis/easy-pace";
import { loggingStreak } from "@/lib/kpis/logging-streak";
import { progressToGoal } from "@/lib/kpis/progress-to-goal";
import { sevenDayAverage } from "@/lib/kpis/seven-day-average";
import { stepsToday } from "@/lib/kpis/steps-today";
import { todaysWeight } from "@/lib/kpis/todays-weight";
import { vo2max } from "@/lib/kpis/vo2max";
import { weeklyMiles } from "@/lib/kpis/weekly-miles";
import { weeklyRate } from "@/lib/kpis/weekly-rate";
import type { KpiDefinition, TabKey } from "@/lib/dashboard/types";

// The cards across the top of the dashboard, in order. Adding one = one new file exporting a
// KpiDefinition plus one line here.
export const KPIS: KpiDefinition[] = [
  todaysWeight,
  sevenDayAverage,
  weeklyRate,
  progressToGoal,
  loggingStreak,
  stepsToday,
  weeklyMiles,
  easyPace,
  vo2max,
];

// Which KPI cards each tab shows, by id (the Daily feel tab has none).
export const TAB_KPIS: Record<TabKey, readonly string[]> = {
  today: [],
  weight: ["todays-weight", "seven-day-average", "weekly-rate", "progress-to-goal", "logging-streak"],
  training: ["steps-today", "weekly-miles", "easy-pace", "vo2max"],
};
