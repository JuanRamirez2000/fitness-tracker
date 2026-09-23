/**
 * The hues heatmap fills are computed from. Fills are mixed in code, and CSS variables cannot
 * be mixed in JS, so these mirror the tokens in app/globals.css (tokens.test.ts keeps the
 * default palette in sync).
 */
export interface Palette {
  good: string;
  bad: string;
  /** Calorie "missed". Equal to `bad` in every palette below — a distinct shade only ever
   * showed up in one of the four color-blind options the user was offered and didn't pick. */
  missed: string;
  warn: string;
  accent: string;
}

// Sky blue / vermillion — chosen by the user from four color-blind-safe options (2026-09-23),
// as the app's one default rather than a separate opt-in mode: distinguishable under every
// common form of color vision deficiency by construction, so there is no "normal" palette to
// fall back to and no toggle needed for this reason. COLOR_BLIND_PALETTE below predates this
// choice (the original default was a plain green/coral) and is unused in any component now —
// still referenced by a few heatmap/paint tests as a second, differently-hued palette to prove
// those functions don't hardcode colors.
export const DEFAULT_PALETTE: Palette = {
  good: "#5b9bd5",
  bad: "#d9573b",
  missed: "#d9573b",
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
