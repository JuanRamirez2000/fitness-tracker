// Neutral cell colors read off the design. Hue-based fills come from the palette instead.

/** A day with nothing recorded. Distinct from a missed calorie day, which is coral. */
export const CELL_NO_DATA = "#20262e";

/** A recorded weigh-in whose change is inside the dead zone. */
export const CELL_FLAT = "#39424c";

/** A 7-day average that does not have enough weigh-ins yet; a step lighter than no data. */
export const CELL_WARMING_UP = "#2a313b";

/** Where the steps ramp starts, before it blends toward the accent. */
export const CELL_STEPS_FLOOR = "#253444";

/**
 * How a cell is painted. `secondFill` marks a "multiple" cell (drawn as a diagonal split) and
 * `notch` adds the corner cut-out, so neither state relies on color alone.
 */
export interface CellPaint {
  fill: string;
  secondFill?: string;
  notch?: boolean;
}
