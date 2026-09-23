/**
 * Neutral surface/text colors code needs as plain values, not just CSS variables. Mirror
 * --card and --muted-2 in app/globals.css; tokens.test.ts keeps them in sync.
 */
export const CARD_BG = "#12161b";
/** Used as the ink-contrast basis for a star on a future or pre-program cell (HeatmapGrid,
 * which has no solid fill of its own to check). */
export const MUTED_2 = "#8b929d";

/** Light-theme ("Warm cream") mirrors of the two constants above — see
 * app/globals.css's `[data-theme="light"]` block for the CSS side. */
export const LIGHT_CARD_BG = "#ffffff";
export const LIGHT_MUTED_2 = "#6b655c";

export function cardBgFor(mode: "dark" | "light"): string {
  return mode === "light" ? LIGHT_CARD_BG : CARD_BG;
}
