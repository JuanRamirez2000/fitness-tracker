// Matches the design's own spark(): a 120-wide viewBox, 2px inset on each side, normalized to
// the series' own min/max so a flat or noisy run both read clearly. Height defaults to the
// original 26px (1x1/2x1 cards never show a sparkline at all, so this only ever mattered for
// the old fixed hero size) but the bento grid's bigger footprints (1x2/2x2) pass a taller one
// so the chart actually uses the extra room those cards have, instead of staying a tiny fixed
// line inside a much bigger card.
const WIDTH = 120;
const INSET = 2;
const DEFAULT_HEIGHT = 26;
const TOP_INSET = 3;

export const SPARKLINE_WIDTH = WIDTH;

/** Where point `i` of `n` sits across the sparkline, in viewBox units (points are evenly spaced). */
export function sparklineX(i: number, n: number): number {
  return n < 2 ? WIDTH / 2 : INSET + (i / (n - 1)) * (WIDTH - INSET * 2);
}

/** A sparkline's y for `v` in viewBox units: `domain` is [min, max]; `invert` puts the min on top. */
export function sparklineY(v: number, domain: [number, number], height: number = DEFAULT_HEIGHT, invert = false): number {
  const [min, max] = domain;
  const spread = max - min || 1;
  const t = (v - min) / spread;
  return height - TOP_INSET - (invert ? 1 - t : t) * (height - TOP_INSET * 2);
}

/**
 * An SVG path `d` for a small trend line. A single point (or none) draws a flat baseline.
 * `domain` defaults to the values' own min/max; pass a wider one to fit a band behind them.
 */
export function sparklinePath(
  values: readonly number[],
  height: number = DEFAULT_HEIGHT,
  domain?: [number, number],
  invert = false,
): string {
  if (values.length < 2) return `M${INSET} ${height - TOP_INSET} L${WIDTH - INSET} ${height - TOP_INSET}`;
  const d = domain ?? [Math.min(...values), Math.max(...values)];
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${sparklineX(i, values.length).toFixed(1)} ${sparklineY(v, d, height, invert).toFixed(1)}`)
    .join(" ");
}

/** A closed path for a band (low to high per point) behind a sparkline, on the same scale. */
export function sparklineBandPath(lows: readonly number[], highs: readonly number[], height: number, domain: [number, number], invert = false): string {
  const n = lows.length;
  if (n < 2) return "";
  const top = highs.map((v, i) => `${i === 0 ? "M" : "L"}${sparklineX(i, n).toFixed(1)} ${sparklineY(v, domain, height, invert).toFixed(1)}`);
  const bottom = lows.map((v, i) => i).reverse().map((i) => `L${sparklineX(i, n).toFixed(1)} ${sparklineY(lows[i], domain, height, invert).toFixed(1)}`);
  return `${top.join(" ")} ${bottom.join(" ")} Z`;
}
