import { RecoveryTooltip } from "@/components/heatmap/tooltips/recovery-tooltip";
import { mix } from "@/lib/color";
import type { DashboardData, HeatmapCell, HeatmapMode, LegendItem, ModeContext } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { cellDateState, isInRange } from "@/lib/heatmap/cell-state";
import { CELL_NO_DATA, CELL_STEPS_FLOOR } from "@/lib/heatmap/colors";
import type { Palette } from "@/lib/theme/palette";

/** What the recovery modes' Tooltip reads back out of HeatmapCell.tooltip: that morning's numbers. */
export interface RecoveryTooltipData {
  readiness: number | null;
  sleepScore: number | null;
  sleepHours: number | null;
  hrv: number | null;
}

/** Scores below this all take the floor color: few mornings go lower, and the scale spreads what's left. */
const SCORE_FLOOR = 30;

/** A 0-100 score's fill: the floor at 30 or under, toward the accent, reaching it at 100. */
export function scoreFill(score: number, palette: Palette): string {
  return mix(CELL_STEPS_FLOOR, palette.accent, Math.min(1, Math.max(0, (score - SCORE_FLOOR) / (100 - SCORE_FLOOR))));
}

function recoveryMode(id: "readiness" | "sleep-score", label: string, pick: (t: RecoveryTooltipData) => number | null): HeatmapMode {
  return {
    id,
    label,
    toCells(data: DashboardData, ctx: ModeContext): HeatmapCell[] {
      const recovery = new Map(data.recovery.map((r) => [r.local_date, r]));
      const sleep = new Map(data.sleep.map((n) => [n.local_date, n]));
      return eachDay(data.heatmap.window.from, data.heatmap.window.to).map((date) => {
        const dateState = cellDateState(date, data.programStart, data.today);
        const inRange = isInRange(date, ctx.range);
        if (dateState !== "in_program") return { date, fill: null, state: dateState, inRange, tooltip: null };
        const r = recovery.get(date);
        const n = sleep.get(date);
        const tooltip: RecoveryTooltipData = {
          readiness: r?.readiness_morning_score ?? r?.readiness_score ?? null,
          sleepScore: n?.score ?? null,
          sleepHours: n?.duration_s ? n.duration_s / 3600 : null,
          hrv: r?.hrv_ms ?? null,
        };
        const value = pick(tooltip);
        if (value === null) return { date, fill: CELL_NO_DATA, state: "none", inRange, tooltip: tooltip.readiness ?? tooltip.sleepScore ?? tooltip.hrv ? tooltip : null };
        return { date, fill: scoreFill(value, ctx.palette), state: "data", inRange, tooltip };
      });
    },
    legend(ctx: ModeContext): LegendItem[] {
      return [
        { label: `${SCORE_FLOOR} or less`, swatch: scoreFill(SCORE_FLOOR, ctx.palette) },
        { label: "65", swatch: scoreFill(65, ctx.palette) },
        { label: "100", swatch: scoreFill(100, ctx.palette) },
        { label: "no data", swatch: CELL_NO_DATA },
        { label: "future", swatch: "transparent" },
      ];
    },
    Tooltip: RecoveryTooltip,
  };
}

/** Each morning's training readiness (the score at wake). */
export const READINESS_MODE = recoveryMode("readiness", "Readiness", (t) => t.readiness);
/** Each night's sleep score, on its wake-up day. */
export const SLEEP_SCORE_MODE = recoveryMode("sleep-score", "Sleep score", (t) => t.sleepScore);
