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

/**
 * Metadata for the data table's tab bar. Each tab's real TableTab<Row, Values> — Row and
 * Values differ per table, so five of them cannot live in one array without an `any` at the
 * seam — is built by its own factory in lib/dashboard/table-tabs/ and switched on by id in
 * DataTableSection, which is the one place (besides this list) a new tab needs a line added.
 */
export const TABLE_TAB_IDS = ["weigh-ins", "calories", "activity", "steps", "shots"] as const;
export type TableTabId = (typeof TABLE_TAB_IDS)[number];

export const TABLE_TAB_LABELS: Record<TableTabId, string> = {
  "weigh-ins": "Weigh-ins",
  calories: "Calories",
  activity: "Activity",
  steps: "Steps",
  shots: "Shots",
};
