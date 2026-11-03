import { RunningTooltip } from "@/components/heatmap/tooltips/running-tooltip";
import { mix } from "@/lib/color";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_STEPS_FLOOR } from "@/lib/heatmap/colors";
import { fmtPace, paceSecPerMile, runMiles, runSpeedMps, runsByDate, runsOf } from "@/lib/running/runs";
import type { Palette } from "@/lib/theme/palette";

/** A day at or past this many miles gets the full accent. */
export const RUNNING_FULL_MILES = 5;

export interface RunningTooltipRun {
  name: string;
  miles: number;
  /** "12:05", or null without a speed. */
  pace: string | null;
  avgHr: number | null;
}

/** What the running mode's Tooltip reads back out of HeatmapCell.tooltip; no runs = rest day. */
export interface RunningTooltipData {
  runs: RunningTooltipRun[];
}

/** A day's fill: the steps floor on a rest day, toward the accent by RUNNING_FULL_MILES. */
export function runningFill(miles: number, palette: Palette): string {
  return mix(CELL_STEPS_FLOOR, palette.accent, Math.min(1, Math.max(0, miles / RUNNING_FULL_MILES)));
}

export const RUNNING_MODE: HeatmapMode = {
  id: "running",
  label: "Running",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const byDate = runsByDate(runsOf(data.activities));

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }
      const runs = byDate.get(date) ?? [];
      const tooltip: RunningTooltipData = {
        runs: runs.map((r) => {
          const speed = runSpeedMps(r);
          return { name: r.name ?? "Run", miles: runMiles(r), pace: speed ? fmtPace(paceSecPerMile(speed)) : null, avgHr: r.avg_hr };
        }),
      };
      const miles = tooltip.runs.reduce((sum, r) => sum + r.miles, 0);
      return { date, fill: runningFill(miles, ctx.palette), state: "data", inRange, tooltip };
    });
  },
  legend(ctx: ModeContext): LegendItem[] {
    return [
      { label: "rest", swatch: runningFill(0, ctx.palette) },
      { label: "2.5 mi", swatch: runningFill(2.5, ctx.palette) },
      { label: `${RUNNING_FULL_MILES}+ mi`, swatch: runningFill(RUNNING_FULL_MILES, ctx.palette) },
      { label: "future", swatch: "transparent" },
    ];
  },
  Tooltip: RunningTooltip,
};
