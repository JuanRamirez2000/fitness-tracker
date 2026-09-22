import { CaloriesTooltip } from "@/components/heatmap/tooltips/calories-tooltip";
import type { TrackingStatus } from "@/lib/data/nutrition-days";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { caloriesPaint } from "@/lib/heatmap/paints";

export interface CaloriesTooltipData {
  status: TrackingStatus;
  caloriesKcal: number | null;
  notes: string | null;
}

export const CALORIES_MODE: HeatmapMode = {
  id: "calories",
  label: "Calories",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const byDate = new Map(data.heatmap.nutritionDays.map((row) => [row.local_date, row] as const));

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }

      const row = byDate.get(date);
      const paint = caloriesPaint(row?.tracking_status, ctx.palette);
      const tooltip: CaloriesTooltipData | null = row
        ? { status: row.tracking_status, caloriesKcal: row.calories_kcal, notes: row.notes }
        : null;

      return { date, fill: paint?.fill ?? CELL_NO_DATA, state: row ? "data" : "none", inRange, tooltip };
    });
  },
  legend(ctx: ModeContext): LegendItem[] {
    return [
      { label: "accurate", swatch: ctx.palette.good },
      { label: "may be off", swatch: ctx.palette.warn },
      { label: "missed", swatch: ctx.palette.missed },
      { label: "nothing logged", swatch: CELL_NO_DATA },
    ];
  },
  Tooltip: CaloriesTooltip,
};
