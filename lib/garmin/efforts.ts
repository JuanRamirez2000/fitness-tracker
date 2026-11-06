/**
 * A run's best efforts, from its samples: the fastest time over set distances anywhere in the
 * run, and its longest stretch of continuous running. Pure, unit-tested (efforts.test.ts). The
 * import works these out from Garmin's full-resolution samples; runs imported before then from
 * their stored, thinned series (scripts/backfill-efforts.ts), which is close enough at a few
 * seconds a point.
 */
import type { ActivityEfforts } from "../data/activity-details";

/** The distances a best effort is kept for, in meters. */
export const EFFORT_DISTANCES = { mile: 1609.344, two_mile: 3218.688, five_k: 5000 } as const;
export type EffortKey = keyof typeof EFFORT_DISTANCES;

/**
 * Cadence (steps a minute, both feet) at or above this counts as running. Walking sits around
 * 100-125 and this athlete's running around 150-170, so 140 splits a run/walk cleanly.
 */
export const RUNNING_CADENCE = 140;
/** A dip under the running cadence this short (seconds) doesn't end a running stretch: a stoplight, a GPS blip. */
const RUNNING_GAP_S = 15;

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * The least time to cover `meters` anywhere in a run: a window slid along the cumulative distance,
 * its start interpolated to exactly `meters` before each sample. Null when the run is shorter.
 */
export function fastestOver(t: readonly number[], d: readonly (number | null)[], meters: number): number | null {
  const pts = t.flatMap((ti, i) => (finite(d[i]) ? [{ t: ti, d: d[i] as number }] : []));
  if (pts.length < 2 || pts[pts.length - 1].d - pts[0].d < meters) return null;
  let best = Infinity;
  let j = 0;
  for (let i = 1; i < pts.length; i++) {
    const target = pts[i].d - meters;
    if (target < pts[0].d) continue;
    // The last sample at or before the window's start.
    while (j + 1 < i && pts[j + 1].d <= target) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const frac = b.d === a.d ? 0 : (target - a.d) / (b.d - a.d);
    const start = a.t + frac * (b.t - a.t);
    best = Math.min(best, pts[i].t - start);
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

/** The longest stretch at running cadence, as seconds and meters; null without cadence or any running. */
export function longestRunning(
  t: readonly number[],
  d: readonly (number | null)[] | undefined,
  cadence: readonly (number | null)[] | undefined,
): { seconds: number; meters: number | null } | null {
  if (!cadence) return null;
  let best: { seconds: number; meters: number | null } | null = null;
  let start: number | null = null;
  let lastRunning: number | null = null;
  const close = () => {
    if (start === null || lastRunning === null) return;
    const seconds = t[lastRunning] - t[start];
    const ds = d?.[start];
    const de = d?.[lastRunning];
    if (seconds > 0 && (!best || seconds > best.seconds)) best = { seconds: Math.round(seconds), meters: finite(ds) && finite(de) ? Math.round(de - ds) : null };
  };
  for (let i = 0; i < t.length; i++) {
    const c = cadence[i];
    if (finite(c) && c >= RUNNING_CADENCE) {
      if (start === null) start = i;
      lastRunning = i;
    } else if (start !== null && lastRunning !== null && t[i] - t[lastRunning] > RUNNING_GAP_S) {
      close();
      start = null;
      lastRunning = null;
    }
  }
  close();
  return best;
}

/** Every best effort for one run's samples. */
export function bestEfforts(
  t: readonly number[],
  d: readonly (number | null)[] | undefined,
  cadence: readonly (number | null)[] | undefined,
): ActivityEfforts {
  const fastest = Object.fromEntries(
    (Object.entries(EFFORT_DISTANCES) as [EffortKey, number][]).map(([key, meters]) => [key, d ? fastestOver(t, d, meters) : null]),
  ) as Record<EffortKey, number | null>;
  return { fastest, longest_running: longestRunning(t, d, cadence) };
}
