import { mix } from "@/lib/color";
import { MIN_AVG7_SAMPLES, type WeightTrendRow } from "@/lib/data/weight-trend";
import type { Palette } from "@/lib/theme/palette";
import { CELL_FLAT, CELL_NO_DATA, CELL_WARMING_UP } from "./colors";

/**
 * Starting guesses, to tune after two or three weeks of real data. A day's change is a
 * percentage of the previous recorded value: inside `deadPct` the cell is neutral, and the
 * color saturates at `capPct`.
 */
export const WEIGHT_RULES = {
  raw: { capPct: 1.0, deadPct: 0.15 },
  avg7: { capPct: 0.15, deadPct: 0.02 },
} as const;

export type WeightMode = keyof typeof WEIGHT_RULES;

/** Color intensity never drops below this once a change is outside the dead zone. */
const MIN_INTENSITY = 0.25;

export type WeightCellState = "data" | "none" | "warming_up";

export interface WeightCell {
  state: WeightCellState;
  /** null when nothing was recorded that day. */
  fill: string | null;
}

export interface WeightDelta {
  deltaLb: number;
  /** Change as a percentage of the previous recorded value, signed. */
  pct: number;
}

/**
 * The change against the previous RECORDED day in the given mode, or null for the first ever
 * weigh-in. `previous` is the prior row in the series, which is what the view's lag() compared.
 */
export function weightDelta(
  mode: WeightMode,
  row: WeightTrendRow,
  previous: WeightTrendRow | null,
): WeightDelta | null {
  const deltaLb = mode === "raw" ? row.raw_delta_lb : row.avg7_delta_lb;
  const before = previous && (mode === "raw" ? previous.weight_lb : previous.avg7_lb);
  if (deltaLb === null || !before || before <= 0) return null;
  return { deltaLb, pct: (deltaLb / before) * 100 };
}

/**
 * Down is the good hue, up the bad hue, and the intensity ramps from the dead zone to the cap.
 * No weigh-in is no data; the first ever weigh-in has nothing to compare with, so it is grey;
 * and the 7-day average shows as warming up until it has enough weigh-ins behind it.
 */
export function weightCell(
  mode: WeightMode,
  row: WeightTrendRow | undefined,
  previous: WeightTrendRow | null,
  palette: Palette,
): WeightCell {
  if (!row) return { state: "none", fill: null };
  if (mode === "avg7" && row.n7 < MIN_AVG7_SAMPLES) {
    return { state: "warming_up", fill: CELL_WARMING_UP };
  }

  const delta = weightDelta(mode, row, previous);
  if (!delta) return { state: "data", fill: CELL_NO_DATA };

  const { capPct, deadPct } = WEIGHT_RULES[mode];
  const size = Math.abs(delta.pct);
  if (size < deadPct) return { state: "data", fill: CELL_FLAT };

  const t = Math.min(1, (size - deadPct) / (capPct - deadPct));
  const hue = delta.deltaLb < 0 ? palette.good : palette.bad;
  return { state: "data", fill: mix(CELL_FLAT, hue, MIN_INTENSITY + (1 - MIN_INTENSITY) * t) };
}
