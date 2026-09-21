/**
 * The hues heatmap fills are computed from. Fills are mixed in code, and CSS variables cannot
 * be mixed in JS, so these mirror the tokens in app/globals.css (tokens.test.ts keeps the
 * default palette in sync). The color-blind palette is the design's teal/orange swap.
 */
export interface Palette {
  good: string;
  bad: string;
  /** Calorie "missed". Equal to `bad` except in the color-blind palette, as in the design. */
  missed: string;
  warn: string;
  accent: string;
}

export const DEFAULT_PALETTE: Palette = {
  good: "#4fb783",
  bad: "#c9736b",
  missed: "#c9736b",
  warn: "#d9a441",
  accent: "#7fb2ff",
};

export const COLOR_BLIND_PALETTE: Palette = {
  good: "#3fb0c9",
  bad: "#e08a45",
  missed: "#c0705f",
  warn: "#d9a441",
  accent: "#7fb2ff",
};
