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
  /** A sparkline needs real width to read as a shape, not just height — only at 2x2. */
  showSparkline: boolean;
}

// A literal table, not an area heuristic — there are exactly 4 footprints, and 1x2 vs 2x1
// need different rules (both area 2) despite the same cell count: 2x1 is wide but short, so a
// progress bar/sparkline would be squashed; 1x2 is narrow but tall, so a progress bar (which
// only needs height, not width) fits while a sparkline still wouldn't.
const TIERS: Record<string, CardTier> = {
  "1x1": { valueSize: 22, unitSize: 11, showDelta: false, showSub: false, showVisual: false, showSparkline: false },
  "2x1": { valueSize: 26, unitSize: 12, showDelta: true, showSub: true, showVisual: false, showSparkline: false },
  "1x2": { valueSize: 26, unitSize: 12, showDelta: true, showSub: true, showVisual: true, showSparkline: false },
  "2x2": { valueSize: 44, unitSize: 14, showDelta: true, showSub: true, showVisual: true, showSparkline: true },
};

export function resolveCardTier(footprint: Footprint): CardTier {
  return TIERS[`${footprint.w}x${footprint.h}`];
}
