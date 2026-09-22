/**
 * Neutral surface colors code needs as plain values, not just CSS variables — currently just
 * the card background, used as the ink-contrast basis for a star on a future or pre-program
 * cell, which has no solid fill of its own (see HeatmapGrid). Mirrors --card in
 * app/globals.css; tokens.test.ts keeps the two in sync.
 */
export const CARD_BG = "#12161b";
