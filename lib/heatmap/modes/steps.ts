import { StepsTooltip } from "@/components/heatmap/tooltips/steps-tooltip";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { mix } from "@/lib/color";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_NO_DATA, CELL_STEPS_FLOOR } from "@/lib/heatmap/colors";
import { stepsPaint } from "@/lib/heatmap/paints";

export interface StepsTooltipData {
  steps: number;
  goal: number;
  hit: boolean;
}

export const STEPS_MODE: HeatmapMode = {
  id: "steps",
  label: "Steps",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const byDate = new Map(data.heatmap.steps.map((row) => [row.local_date, row] as const));
    const goal = data.profile.steps_goal;

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }

      const row = byDate.get(date);
      const paint = stepsPaint(row?.value, goal, ctx.palette);
      const tooltip: StepsTooltipData | null =
        row !== undefined ? { steps: row.value, goal, hit: row.value >= goal } : null;

      return { date, fill: paint?.fill ?? CELL_NO_DATA, state: row !== undefined ? "data" : "none", inRange, tooltip };
    });
  },
  // Labeled by fraction of the athlete's own steps_goal rather than literal counts, since
  // steps_goal is configurable (schema default 10,000, but not fixed).
  legend(ctx: ModeContext): LegendItem[] {
    return [
      { label: "0", swatch: CELL_STEPS_FLOOR },
      { label: "25%", swatch: mix(CELL_STEPS_FLOOR, ctx.palette.accent, 0.28) },
      { label: "75%", swatch: mix(CELL_STEPS_FLOOR, ctx.palette.accent, 0.75) },
      { label: "goal+", swatch: ctx.palette.accent },
    ];
  },
  Tooltip: StepsTooltip,
};
