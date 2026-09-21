import { contrastRatio } from "@/lib/color";

// Pure white and black rather than the design's off-white and off-black: at the mid-luminance
// crossover the best of those two only reaches 4.25:1, while white/black always reach 4.58:1.
export const STAR_INK_LIGHT = "#ffffff";
export const STAR_INK_DARK = "#000000";

/**
 * Whichever ink reads best on the cell. A split "multiple" cell passes both of its colors and
 * the ink is chosen for the worse of the two.
 */
export function starInk(...fills: string[]): string {
  const worstCase = (ink: string) => Math.min(...fills.map((fill) => contrastRatio(ink, fill)));
  return worstCase(STAR_INK_LIGHT) >= worstCase(STAR_INK_DARK) ? STAR_INK_LIGHT : STAR_INK_DARK;
}
