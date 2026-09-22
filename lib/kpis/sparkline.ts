// Matches the design's own spark(): a 120x26 viewBox, 2px inset on each side, normalized to
// the series' own min/max so a flat or noisy run both read clearly.
const WIDTH = 120;
const INSET = 2;
const HEIGHT = 26;
const TOP_INSET = 3;

/** An SVG path `d` for a small trend line. A single point (or none) draws a flat baseline. */
export function sparklinePath(values: readonly number[]): string {
  if (values.length < 2) return `M${INSET} ${HEIGHT - TOP_INSET} L${WIDTH - INSET} ${HEIGHT - TOP_INSET}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const usableWidth = WIDTH - INSET * 2;
  const usableHeight = HEIGHT - TOP_INSET * 2;

  return values
    .map((v, i) => {
      const x = INSET + (i / (values.length - 1)) * usableWidth;
      const y = HEIGHT - TOP_INSET - ((v - min) / spread) * usableHeight;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
