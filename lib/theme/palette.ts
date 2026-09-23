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

/** The "Warm cream" light theme's semantic colors — mirrors the `[data-theme="light"]`
 * block in app/globals.css (same tokens.test.ts-style sync this file's top comment
 * describes for the dark default, just not machine-checked for this second theme). */
export const LIGHT_PALETTE: Palette = {
  good: "#1f6f92",
  bad: "#af4a26",
  missed: "#af4a26",
  warn: "#8a5a10",
  accent: "#2f5f9e",
};

/** The one place that decides which literal palette a piece of JS color math (heatmap fills,
 * the calories chart's legend/bars) should use for the active theme — everything else that
 * only ever needs a semantic color for a static inline style or SVG paint should reach for
 * the CSS variable directly (`var(--good)`, etc.) instead, which re-themes for free and
 * needs no theme state at all. This function exists for the handful of call sites that
 * mix()/contrastRatio() a real hex value, which a CSS variable string can't do. */
export function paletteFor(mode: "dark" | "light"): Palette {
  return mode === "light" ? LIGHT_PALETTE : DEFAULT_PALETTE;
}
