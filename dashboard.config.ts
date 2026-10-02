import { loggingStreak } from "@/lib/kpis/logging-streak";
import { progressToGoal } from "@/lib/kpis/progress-to-goal";
import { sevenDayAverage } from "@/lib/kpis/seven-day-average";
import { stepsToday } from "@/lib/kpis/steps-today";
import { todaysWeight } from "@/lib/kpis/todays-weight";
import { weeklyRate } from "@/lib/kpis/weekly-rate";
import type { KpiDefinition } from "@/lib/dashboard/types";

// The cards across the top of the dashboard, in order. Adding one = one new file exporting a
// KpiDefinition plus one line here.
export const KPIS: KpiDefinition[] = [todaysWeight, sevenDayAverage, weeklyRate, progressToGoal, loggingStreak, stepsToday];
