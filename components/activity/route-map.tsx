import type { ActivitySeries } from "@/lib/data/activity-details";
import type { ZoneRow } from "@/lib/activity/view";

const SIZE = 300;
const PAD = 10;
const ZONE_STROKES = ["stroke-z1", "stroke-z2", "stroke-z3", "stroke-z4", "stroke-z5"];

interface Pt {
  i: number;
  x: number;
  y: number;
}

/** The zone (0-4) a heart rate falls in, by each zone's lower bound. */
function zoneOf(hr: number | null, lows: number[]): number | null {
  if (hr === null || !lows.length) return null;
  let z = 0;
  for (let k = 0; k < lows.length; k++) if (hr >= lows[k]) z = k;
  return z;
}

/**
 * The GPS route drawn to scale (an equirectangular projection is plenty at a run's size),
 * colored by heart-rate zone, with a circle at the start, a square at the finish, and a dot at
 * the hovered sample. No map tiles: nothing leaves the page.
 */
export function RouteMap({ series, zones, hover }: { series: ActivitySeries; zones: ZoneRow[] | null; hover: number | null }) {
  const { lat, lon } = series;
  if (!lat || !lon) return null;
  const idx = lat.flatMap((la, i) => (la !== null && lon[i] !== null ? [i] : []));
  if (idx.length < 2) return null;

  const lats = idx.map((i) => lat[i] as number);
  const lons = idx.map((i) => lon[i] as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * k;
  const spanY = maxLat - minLat;
  const scale = (SIZE - 2 * PAD) / Math.max(spanX, spanY, 1e-9);
  const w = spanX * scale + 2 * PAD;
  const h = spanY * scale + 2 * PAD;
  const project = (i: number): Pt => ({ i, x: PAD + ((lon[i] as number) - minLon) * k * scale, y: PAD + (maxLat - (lat[i] as number)) * scale });
  const pts = idx.map(project);

  const lows = zones?.flatMap((z) => (z.low !== null ? [z.low] : [])) ?? [];
  const colored = !!series.hr && lows.length === 5;
  // Consecutive points in the same zone share one polyline; each starts at the previous one's end.
  const runs: { zone: number | null; pts: Pt[] }[] = [];
  for (const p of pts) {
    const zone = colored ? zoneOf(series.hr![p.i], lows) : null;
    const last = runs.at(-1);
    if (last && last.zone === zone) last.pts.push(p);
    else runs.push({ zone, pts: last ? [last.pts[last.pts.length - 1], p] : [p] });
  }
  const start = pts[0];
  const end = pts[pts.length - 1];
  const hovered = hover !== null && lat[hover] !== null && lon[hover] !== null ? project(hover) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto block h-auto max-h-[280px] w-full" role="img" aria-label="Route outline, colored by heart-rate zone">
      {runs.map((r, n) => (
        <polyline
          key={n}
          points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")}
          className={`fill-none ${r.zone === null ? (colored ? "stroke-muted-3" : "stroke-accent") : ZONE_STROKES[r.zone]}`}
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      <circle cx={start.x} cy={start.y} r={4.5} className="fill-card stroke-ink" strokeWidth={1.8} />
      <rect x={end.x - 4} y={end.y - 4} width={8} height={8} className="fill-ink" />
      {hovered && <circle cx={hovered.x} cy={hovered.y} r={5.5} className="fill-ink stroke-card" strokeWidth={2} />}
    </svg>
  );
}
