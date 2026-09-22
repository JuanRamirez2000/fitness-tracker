import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { HeatmapMode } from "@/lib/dashboard/types";

// Adding a metric = one new file exporting a HeatmapMode plus one line here — no changes to
// HeatmapCard or HeatmapGrid. Calories, activity, steps and logged land in build step 4.
export const HEATMAP_MODES: HeatmapMode[] = [WEIGHT_MODE];
