import { TrainingTooltip } from "@/components/heatmap/tooltips/training-tooltip";
import { mix } from "@/lib/color";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_STEPS_FLOOR } from "@/lib/heatmap/colors";
import { fmtPace, paceSecPerMile, runMiles, runSpeedMps, runsByDate } from "@/lib/running/runs";
import { activitiesFor, isRun, mph, type SportFilter } from "@/lib/sport";
import type { Palette } from "@/lib/theme/palette";

/**
 * What a day is measured by under each sport filter, and the amount that gets the full accent.
 * Rides and runs by miles (a ride covers several times a run's distance); "all" by minutes, since
 * a ride's miles and a run's miles don't add up to anything meaningful.
 */
export const TRAINING_SCALE: Record<SportFilter, { by: "miles" | "minutes"; full: number }> = {
  ride: { by: "miles", full: 25 },
  run: { by: "miles", full: 5 },
  all: { by: "minutes", full: 90 },
};

export interface TrainingTooltipItem {
  name: string;
  /** "ride" or "run": the tooltip's row label. */
  sport: "ride" | "run";
  miles: number;
  minutes: number;
  /** "12:05/mi" for a run, "17.2 mph" for a ride; null without a speed. */
  speed: string | null;
  avgHr: number | null;
}

/** What the training mode's Tooltip reads back out of HeatmapCell.tooltip; no items = rest day. */
export interface TrainingTooltipData {
  items: TrainingTooltipItem[];
}

/** A day's fill: the steps floor on a rest day, toward the sport's hue by the filter's full
 * amount. Under All the hue is the day's main sport (`hue`); otherwise the filter's own. */
export function trainingFill(amount: number, sport: SportFilter, palette: Palette, hue: "ride" | "run" = sport === "run" ? "run" : "ride"): string {
  return mix(CELL_STEPS_FLOOR, palette[hue], Math.min(1, Math.max(0, amount / TRAINING_SCALE[sport].full)));
}

/** The sport a day spent the most minutes on (a ride on a tie, being the main sport now). */
export function mainSport(items: TrainingTooltipItem[]): "ride" | "run" {
  const minutes = (sport: "ride" | "run") => items.filter((i) => i.sport === sport).reduce((sum, i) => sum + i.minutes, 0);
  return minutes("run") > minutes("ride") ? "run" : "ride";
}

function tooltipItem(a: DashboardData["activities"][number]): TrainingTooltipItem {
  const run = isRun(a);
  const speed = run ? runSpeedMps(a) : a.avg_speed_mps;
  return {
    name: a.name ?? (run ? "Run" : "Ride"),
    sport: run ? "run" : "ride",
    miles: runMiles(a),
    minutes: (a.moving_duration_s ?? a.duration_s) / 60,
    speed: speed ? (run ? `${fmtPace(paceSecPerMile(speed))}/mi` : `${mph(speed).toFixed(1)} mph`) : null,
    avgHr: a.avg_hr,
  };
}

/** The Training tab's activity heatmap under its sport filter (data.sport), in the sport's hue
 * (under All, each day in the hue of the sport it spent the most minutes on). */
export const TRAINING_MODE: HeatmapMode = {
  id: "training",
  label: "Training",
  toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
    const byDate = runsByDate(activitiesFor(data));
    const scale = TRAINING_SCALE[data.sport];

    return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
      const dateState = cellDateState(date, data.programStart, data.today);
      const inRange = isInRange(date, ctx.range);
      if (dateState !== "in_program") {
        return { date, fill: null, state: dateState, inRange, tooltip: null };
      }
      const tooltip: TrainingTooltipData = { items: (byDate.get(date) ?? []).map(tooltipItem) };
      const amount = tooltip.items.reduce((sum, i) => sum + (scale.by === "miles" ? i.miles : i.minutes), 0);
      const hue = data.sport === "all" ? mainSport(tooltip.items) : undefined;
      return { date, fill: trainingFill(amount, data.sport, ctx.palette, hue), state: "data", inRange, tooltip };
    });
  },
  legend(ctx: ModeContext): LegendItem[] {
    const { sport } = ctx;
    const { by, full } = TRAINING_SCALE[sport];
    const unit = by === "miles" ? "mi" : "min";
    if (sport === "all") {
      return [
        { label: "rest", swatch: trainingFill(0, sport, ctx.palette) },
        { label: `${full / 2} ${unit}`, swatch: trainingFill(full / 2, sport, ctx.palette, "ride") },
        { label: `${full}+ ${unit} ride`, swatch: trainingFill(full, sport, ctx.palette, "ride") },
        { label: `${full}+ ${unit} run`, swatch: trainingFill(full, sport, ctx.palette, "run") },
        { label: "future", swatch: "transparent" },
      ];
    }
    return [
      { label: "rest", swatch: trainingFill(0, sport, ctx.palette) },
      { label: `${full / 2} ${unit}`, swatch: trainingFill(full / 2, sport, ctx.palette) },
      { label: `${full}+ ${unit}`, swatch: trainingFill(full, sport, ctx.palette) },
      { label: "future", swatch: "transparent" },
    ];
  },
  Tooltip: TrainingTooltip,
};
