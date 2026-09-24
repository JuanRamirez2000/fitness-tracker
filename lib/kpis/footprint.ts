export interface Footprint {
  w: 1 | 2;
  h: 1 | 2;
}

export interface CardTier {
  valueSize: number;
  unitSize: number;
  showDelta: boolean;
  showSub: boolean;
  /** A progress bar fits in any height-2 card — it's a thin strip, doesn't need width. */
  showVisual: boolean;
  /** A sparkline needs real height to read as a shape more than width — h=2 is enough even at
   * w=1 (narrower, not squashed flat); h=1 genuinely isn't tall enough at any width. */
  showSparkline: boolean;
  /** Both visuals scale with the card's actual height instead of staying a fixed size that
   * ignores the extra room a bigger card has — h=1 cards never show either, so 0 there. */
  sparklineHeight: number;
  progressBarHeight: number;
}

// A literal table, not an area heuristic — there are exactly 4 footprints, and 1x2 vs 2x1
// need different rules (both area 2) despite the same cell count: 2x1 is wide but short, so a
// chart would be squashed to almost nothing; 1x2 is narrow but tall, so both visuals fit.
const TIERS: Record<string, CardTier> = {
  "1x1": { valueSize: 22, unitSize: 11, showDelta: false, showSub: false, showVisual: false, showSparkline: false, sparklineHeight: 0, progressBarHeight: 6 },
  "2x1": { valueSize: 26, unitSize: 12, showDelta: true, showSub: true, showVisual: false, showSparkline: false, sparklineHeight: 0, progressBarHeight: 6 },
  "1x2": { valueSize: 26, unitSize: 12, showDelta: true, showSub: true, showVisual: true, showSparkline: true, sparklineHeight: 72, progressBarHeight: 8 },
  "2x2": { valueSize: 44, unitSize: 14, showDelta: true, showSub: true, showVisual: true, showSparkline: true, sparklineHeight: 88, progressBarHeight: 10 },
};

export function resolveCardTier(footprint: Footprint): CardTier {
  return TIERS[`${footprint.w}x${footprint.h}`];
}
