import { bodyFat } from "@/lib/kpis/body-fat";
import { easyPace } from "@/lib/kpis/easy-pace";
import { hrv } from "@/lib/kpis/hrv";
import { loadRatio } from "@/lib/kpis/load-ratio";
import { loggingStreak } from "@/lib/kpis/logging-streak";
import { progressToGoal } from "@/lib/kpis/progress-to-goal";
import { race5k } from "@/lib/kpis/race-5k";
import { restingHr } from "@/lib/kpis/resting-hr";
import { sevenDayAverage } from "@/lib/kpis/seven-day-average";
import { sleepDebt } from "@/lib/kpis/sleep-debt";
import { sleepScore } from "@/lib/kpis/sleep-score";
import { stepsToday } from "@/lib/kpis/steps-today";
import { todaysWeight } from "@/lib/kpis/todays-weight";
import { vo2max } from "@/lib/kpis/vo2max";
import { weeklyMiles } from "@/lib/kpis/weekly-miles";
import { weeklyRate } from "@/lib/kpis/weekly-rate";
import type { KpiDefinition, TabKey } from "@/lib/dashboard/types";

// The cards across the top of the dashboard, in order. Adding one = one new file exporting a
// KpiDefinition plus one line here.
export const KPIS: KpiDefinition[] = [
  // Daily feel
  sleepScore,
  sleepDebt,
  hrv,
  restingHr,
  stepsToday,
  // Weight
  todaysWeight,
  sevenDayAverage,
  weeklyRate,
  progressToGoal,
  bodyFat,
  loggingStreak,
  // Training
  weeklyMiles,
  easyPace,
  vo2max,
  loadRatio,
  race5k,
];

// Which KPI cards each tab shows, by id. Each tab fills one row of six units (a wide card,
// span 2, takes two), so keep a tab's spans adding up to 6.
export const TAB_KPIS: Record<TabKey, readonly string[]> = {
  today: ["sleep-score", "sleep-debt", "hrv", "resting-hr", "steps-today"],
  weight: ["todays-weight", "seven-day-average", "weekly-rate", "progress-to-goal", "body-fat", "logging-streak"],
  training: ["weekly-miles", "easy-pace", "vo2max", "load-ratio", "race-5k"],
};
