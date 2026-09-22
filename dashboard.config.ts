import { ACTIVITY_MODE } from "@/lib/heatmap/modes/activity";
import { CALORIES_MODE } from "@/lib/heatmap/modes/calories";
import { LOGGED_MODE } from "@/lib/heatmap/modes/logged";
import { STEPS_MODE } from "@/lib/heatmap/modes/steps";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import { caloriesToday } from "@/lib/kpis/calories-today";
import { daysSinceShot } from "@/lib/kpis/days-since-shot";
import { loggingStreak } from "@/lib/kpis/logging-streak";
import { progressToGoal } from "@/lib/kpis/progress-to-goal";
import { sevenDayAverage } from "@/lib/kpis/seven-day-average";
import { stepsToday } from "@/lib/kpis/steps-today";
import { todaysWeight } from "@/lib/kpis/todays-weight";
import { weeklyRate } from "@/lib/kpis/weekly-rate";
import type { HeatmapMode, KpiDefinition } from "@/lib/dashboard/types";

// Adding a metric = one new file exporting a HeatmapMode plus one line here — no changes to
// HeatmapCard or HeatmapGrid.
export const HEATMAP_MODES: HeatmapMode[] = [WEIGHT_MODE, CALORIES_MODE, ACTIVITY_MODE, STEPS_MODE, LOGGED_MODE];

// Adding a critical number = one new file exporting a KpiDefinition plus one line here — no
// changes to the slot grid, which pads out to a full row with the design's empty-slot state.
export const CRITICAL_NUMBERS: KpiDefinition[] = [
  todaysWeight,
  sevenDayAverage,
  weeklyRate,
  progressToGoal,
  loggingStreak,
  daysSinceShot,
  caloriesToday,
  stepsToday,
];
