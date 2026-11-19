import { bodyFat } from "@/lib/kpis/body-fat";
import { climbGain } from "@/lib/kpis/climb-gain";
import { easyPace } from "@/lib/kpis/easy-pace";
import { ftp } from "@/lib/kpis/ftp";
import { hrv } from "@/lib/kpis/hrv";
import { loadRatio } from "@/lib/kpis/load-ratio";
import { loggingStreak } from "@/lib/kpis/logging-streak";
import { progressToGoal } from "@/lib/kpis/progress-to-goal";
import { race5k } from "@/lib/kpis/race-5k";
import { race10k } from "@/lib/kpis/race-10k";
import { restingHr } from "@/lib/kpis/resting-hr";
import { rideHours, rideMiles, swimHours, trainingHours } from "@/lib/kpis/ride-volume";
import { sevenDayAverage } from "@/lib/kpis/seven-day-average";
import { sleepDebt } from "@/lib/kpis/sleep-debt";
import { sleepScore } from "@/lib/kpis/sleep-score";
import { stepsToday } from "@/lib/kpis/steps-today";
import { todaysWeight } from "@/lib/kpis/todays-weight";
import { vo2max } from "@/lib/kpis/vo2max";
import { vo2maxCycling } from "@/lib/kpis/vo2max-cycling";
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
  climbGain,
  loggingStreak,
  // Training
  weeklyMiles,
  easyPace,
  vo2max,
  loadRatio,
  race5k,
  race10k,
  rideMiles,
  rideHours,
  trainingHours,
  ftp,
  vo2maxCycling,
  swimHours,
];

// Which KPI cards each tab shows, by id. Each row fills six units (a wide card, span 2, takes
// two), so keep a row's spans adding up to 6. Training's are per sport (below).
export const TAB_KPIS: Partial<Record<TabKey, readonly string[]>> = {
  weight: ["todays-weight", "seven-day-average", "weekly-rate", "progress-to-goal", "climb-gain", "logging-streak"],
};

// The Training tab's recovery row, under the readiness hero.
export const RECOVERY_KPIS: readonly string[] = ["sleep-score", "sleep-debt", "steps-today"];

// The Training tab's group tiles, one row each (docs/plan-training-split.md).
export const GROUP_KPIS = {
  run: ["race-10k", "vo2max", "easy-pace", "weekly-miles"],
  ride: ["ftp", "vo2max-cycling", "ride-hours", "ride-miles"],
  load: ["load-ratio", "training-hours"],
} as const;
