/**
 * Neutral surface/text colors code needs as plain values, not just CSS variables. Mirror
 * --card and --muted-2 in app/globals.css; tokens.test.ts keeps them in sync.
 */
export const CARD_BG = "#12161b";
/** Used as the ink-contrast basis for a star on a future or pre-program cell (HeatmapGrid,
 * which has no solid fill of its own to check), and as the "neutral" KPI tone (tone-color.ts,
 * no hue in Palette fits it). */
export const MUTED_2 = "#8b929d";
