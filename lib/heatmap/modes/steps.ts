import { StepsTooltip } from "@/components/heatmap/tooltips/steps-tooltip";
import { mix } from "@/lib/color";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { STEPS_GOAL } from "@/lib/data/steps";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_NO_DATA, CELL_STEPS_FLOOR } from "@/lib/heatmap/colors";
import type { Palette } from "@/lib/theme/palette";

/** What the steps mode's Tooltip reads back out of HeatmapCell.tooltip. */
export interface StepsTooltipData {
  steps: number;
  hit: boolean;
}

/** A day's fill: from the floor at 0 steps toward the accent, reaching it at the goal. */
export function stepsFill(steps: number, palette: Palette): string {
  return mix(CELL_STEPS_FLOOR, palette.accent, Math.min(1, Math.max(0, steps / STEPS_GOAL)));
}

export const STEPS_MODE: HeatmapMode = {
  id: "steps",
  label: "Steps",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const byDate = new Map(data.heatmap.steps.map((row) => [row.local_date, row.steps] as const));

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }
      const steps = byDate.get(date);
      if (steps === undefined) return { date, fill: CELL_NO_DATA, state: "none", inRange, tooltip: null };
      const tooltip: StepsTooltipData = { steps, hit: steps >= STEPS_GOAL };
      return { date, fill: stepsFill(steps, ctx.palette), state: "data", inRange, tooltip };
    });
  },
  legend(ctx: ModeContext): LegendItem[] {
    return [
      { label: "0", swatch: stepsFill(0, ctx.palette) },
      { label: "5k", swatch: stepsFill(5_000, ctx.palette) },
      { label: "10k+", swatch: stepsFill(STEPS_GOAL, ctx.palette) },
      { label: "no data", swatch: CELL_NO_DATA },
      { label: "future", swatch: "transparent" },
    ];
  },
  Tooltip: StepsTooltip,
};
