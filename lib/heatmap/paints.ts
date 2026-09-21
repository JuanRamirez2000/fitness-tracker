import { mix } from "@/lib/color";
import type { TrackingStatus } from "@/lib/data/nutrition-days";
import type { Palette } from "@/lib/theme/palette";
import { CELL_NO_DATA, CELL_STEPS_FLOOR, type CellPaint } from "./colors";

/** accurate is good, uncertain is amber, missed is coral. No row at all is no data. */
export function caloriesPaint(status: TrackingStatus | undefined, palette: Palette): CellPaint | null {
  if (!status) return null;
  const fill = { accurate: palette.good, uncertain: palette.warn, missed: palette.missed }[status];
  return { fill };
}

/**
 * Intensity is steps against the goal on the accent, full at or above the goal. A day with a
 * row but zero steps is the ramp's floor, still different from a day with no row.
 */
export function stepsPaint(
  steps: number | undefined,
  goal: number,
  palette: Palette,
): CellPaint | null {
  if (steps === undefined) return null;
  const t = goal > 0 ? Math.min(1, Math.max(0, steps / goal)) : 1;
  return { fill: mix(CELL_STEPS_FLOOR, palette.accent, t) };
}

/**
 * One activity uses its type color. Two or more rows become the "multiple" cell: a diagonal
 * split of the first two colors plus the corner notch, so it reads without relying on hue.
 */
export function activityPaint(colors: readonly string[]): CellPaint | null {
  if (colors.length === 0) return null;
  if (colors.length === 1) return { fill: colors[0] };
  return { fill: colors[0], secondFill: colors[1], notch: true };
}

export type LoggedState = "none" | "steps_only" | "weight_only" | "weight_steps";

// Blend weights toward the accent, from the design.
const LOGGED_STEPS_ONLY = 0.24;
const LOGGED_WEIGHT_ONLY = 0.62;

export function loggedState(weightLogged: boolean, stepsHit: boolean): LoggedState {
  if (weightLogged && stepsHit) return "weight_steps";
  if (weightLogged) return "weight_only";
  return stepsHit ? "steps_only" : "none";
}

/** Weight is the primary signal (stronger fill); both together is full accent plus the notch. */
export function loggedPaint(state: LoggedState, palette: Palette): CellPaint | null {
  switch (state) {
    case "none":
      return null;
    case "steps_only":
      return { fill: mix(CELL_NO_DATA, palette.accent, LOGGED_STEPS_ONLY) };
    case "weight_only":
      return { fill: mix(CELL_NO_DATA, palette.accent, LOGGED_WEIGHT_ONLY) };
    case "weight_steps":
      return { fill: palette.accent, notch: true };
  }
}
