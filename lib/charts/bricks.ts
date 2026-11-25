import { isRide, isRun, type Activity } from "@/lib/data/activities";

/**
 * Bricks: a run that starts within BRICK_GAP_S of a ride ending, indoors or out. Timing alone
 * pairs them, so a Garmin multisport activity (its legs arrive as back-to-back activities, with
 * any transition between them) counts the same way as two separate recordings. Pure.
 */
export const BRICK_GAP_S = 15 * 60;

/** Garmin's start and end times can overlap by a few seconds when one activity follows another. */
const OVERLAP_S = 120;

export interface BrickPair {
  ride: Activity;
  run: Activity;
  /** Seconds from the ride's end to the run's start (the transition); 0 when they overlap. */
  gapS: number;
}

const endMs = (a: Activity) => Date.parse(a.started_at) + a.duration_s * 1000;

/** Every brick, oldest first. Each ride pairs with at most one run (the first after it). */
export function findBricks(activities: readonly Activity[]): BrickPair[] {
  const rides = activities.filter(isRide).map((ride) => ({ ride, end: endMs(ride) }));
  const used = new Set<string>();
  const bricks: BrickPair[] = [];
  for (const run of [...activities].filter(isRun).sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))) {
    const start = Date.parse(run.started_at);
    const before = rides
      .filter((r) => !used.has(r.ride.id) && r.end - OVERLAP_S * 1000 <= start && start - r.end <= BRICK_GAP_S * 1000)
      .sort((a, b) => b.end - a.end)[0];
    if (!before) continue;
    used.add(before.ride.id);
    bricks.push({ ride: before.ride, run, gapS: Math.max(0, Math.round((start - before.end) / 1000)) });
  }
  return bricks;
}

/** The brick a given activity is part of (as the ride or the run), or null. */
export function brickOf(activityId: string, activities: readonly Activity[]): BrickPair | null {
  return findBricks(activities).find((b) => b.ride.id === activityId || b.run.id === activityId) ?? null;
}
