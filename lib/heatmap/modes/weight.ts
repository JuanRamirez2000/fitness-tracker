import { WeightTooltip } from "@/components/heatmap/tooltips/weight-tooltip";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay, type LocalDate } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_FLAT, CELL_NO_DATA } from "@/lib/heatmap/colors";
import { weightCell } from "@/lib/heatmap/weight-rules";

/** What the weight mode's Tooltip reads back out of HeatmapCell.tooltip. */
export interface WeightTooltipData {
  rawLb: number;
  avg7Lb: number | null;
  n7: number;
  raw: { deltaLb: number | null; vsDate: LocalDate | null };
  avg7: { deltaLb: number | null; vsDate: LocalDate | null };
}

// The tooltip always shows raw and 7-day average together, per the brief, regardless of
// which one ctx.weightSubMode colors the cells with.
export const WEIGHT_MODE: HeatmapMode = {
  id: "weight",
  label: "Weight",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    // data.weightTrend is unbounded (see DashboardData's doc comment) and sorted ascending
    // by local_date, so the window's first cell can still see the true previous row even
    // when that row falls before the window (a trailing 53-week window, past the first
    // program year, does not start at the beginning of the user's history).
    const byDate = new Map(data.weightTrend.map((row) => [row.local_date, row] as const));
    let previous: WeightTrendRow | null = null;
    for (const row of data.weightTrend) {
      if (row.local_date >= data.heatmap.window.from) break;
      previous = row;
    }

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      const row = byDate.get(date);

      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }

      const cell = weightCell(ctx.weightSubMode, row, previous, ctx.palette);
      const tooltip: WeightTooltipData | null = row
        ? {
            rawLb: row.weight_lb,
            avg7Lb: row.avg7_lb,
            n7: row.n7,
            raw: { deltaLb: row.raw_delta_lb, vsDate: previous?.local_date ?? null },
            avg7: { deltaLb: row.avg7_delta_lb, vsDate: previous?.local_date ?? null },
          }
        : null;
      if (row) previous = row;

      return { date, fill: cell.fill, state: cell.state, inRange, tooltip };
    });
  },
  legend(ctx: ModeContext): LegendItem[] {
    return [
      { label: "down", swatch: ctx.palette.good },
      { label: "flat", swatch: CELL_FLAT },
      { label: "up", swatch: ctx.palette.bad },
      { label: "no weigh-in", swatch: CELL_NO_DATA },
      { label: "future", swatch: "transparent" },
    ];
  },
  Tooltip: WeightTooltip,
};
