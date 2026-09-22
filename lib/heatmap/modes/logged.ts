import { LoggedTooltip } from "@/components/heatmap/tooltips/logged-tooltip";
import { mix } from "@/lib/color";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { LOGGED_STEPS_ONLY, LOGGED_WEIGHT_ONLY, loggedPaint, loggedState } from "@/lib/heatmap/paints";

export interface LoggedTooltipData {
  weightLogged: boolean;
  steps: number | null;
  stepsHit: boolean;
  goal: number;
}

// Weight is primary, steps secondary (see lib/heatmap/paints.ts).
export const LOGGED_MODE: HeatmapMode = {
  id: "logged",
  label: "Logged",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const weighedOn = new Set(data.weightTrend.map((row) => row.local_date));
    const stepsByDate = new Map(data.heatmap.steps.map((row) => [row.local_date, row] as const));
    const goal = data.profile.steps_goal;

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }

      const stepsRow = stepsByDate.get(date);
      const weightLogged = weighedOn.has(date);
      const stepsHit = (stepsRow?.value ?? 0) >= goal;
      const state = loggedState(weightLogged, stepsHit);
      const paint = loggedPaint(state, ctx.palette);
      const tooltip: LoggedTooltipData = { weightLogged, steps: stepsRow?.value ?? null, stepsHit, goal };

      return {
        date,
        fill: paint?.fill ?? CELL_NO_DATA,
        notch: paint?.notch,
        state: state === "none" ? "none" : "data",
        inRange,
        tooltip,
      };
    });
  },
  legend(ctx: ModeContext): LegendItem[] {
    return [
      { label: "nothing", swatch: CELL_NO_DATA },
      { label: "steps only", swatch: mix(CELL_NO_DATA, ctx.palette.accent, LOGGED_STEPS_ONLY) },
      { label: "weight logged", swatch: mix(CELL_NO_DATA, ctx.palette.accent, LOGGED_WEIGHT_ONLY) },
      { label: "weight + steps", swatch: ctx.palette.accent },
    ];
  },
  Tooltip: LoggedTooltip,
};
