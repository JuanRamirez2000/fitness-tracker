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

/** An SVG path `d` for a small trend line. A single point (or none) draws a flat baseline. */
export function sparklinePath(values: readonly number[], height: number = DEFAULT_HEIGHT): string {
  if (values.length < 2) return `M${INSET} ${height - TOP_INSET} L${WIDTH - INSET} ${height - TOP_INSET}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const usableWidth = WIDTH - INSET * 2;
  const usableHeight = height - TOP_INSET * 2;

  return values
    .map((v, i) => {
      const x = INSET + (i / (values.length - 1)) * usableWidth;
      const y = height - TOP_INSET - ((v - min) / spread) * usableHeight;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
