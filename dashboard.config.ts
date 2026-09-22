import { ACTIVITY_MODE } from "@/lib/heatmap/modes/activity";
import { CALORIES_MODE } from "@/lib/heatmap/modes/calories";
import { LOGGED_MODE } from "@/lib/heatmap/modes/logged";
import { STEPS_MODE } from "@/lib/heatmap/modes/steps";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { HeatmapMode } from "@/lib/dashboard/types";

// Adding a metric = one new file exporting a HeatmapMode plus one line here — no changes to
// HeatmapCard or HeatmapGrid.
export const HEATMAP_MODES: HeatmapMode[] = [WEIGHT_MODE, CALORIES_MODE, ACTIVITY_MODE, STEPS_MODE, LOGGED_MODE];
