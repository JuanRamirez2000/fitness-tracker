/**
 * Which sport an activity is, from Garmin's typeKey. Garmin's keys aren't consistent enough to
 * match on a suffix alone (road_biking, gravel_cycling, virtual_ride, e_bike_fitness), so rides
 * are an explicit list with a pattern as a fallback for keys Garmin adds later. Pure, unit-tested.
 */

/** The Training tab's sport filter (`?sport=`). The first is the default. */
export const SPORT_KEYS = ["all", "ride", "run"] as const;
export type SportFilter = (typeof SPORT_KEYS)[number];
export const DEFAULT_SPORT: SportFilter = "all";
export const SPORT_LABELS: Record<SportFilter, string> = { all: "All", ride: "Ride", run: "Run" };

export type Sport = "ride" | "run" | "other";

/** Garmin's cycling typeKeys (parentTypeId 2). */
export const RIDE_TYPES = [
  "cycling",
  "road_biking",
  "mountain_biking",
  "gravel_cycling",
  "virtual_ride",
  "indoor_cycling",
  "track_cycling",
  "cyclocross",
  "downhill_biking",
  "bmx",
  "recumbent_cycling",
  "hand_cycling",
  "e_bike_fitness",
  "e_bike_mountain",
] as const;

/** Garmin's running typeKeys (parentTypeId 1). */
export const RUN_TYPES = [
  "running",
  "treadmill_running",
  "trail_running",
  "track_running",
  "street_running",
  "indoor_running",
  "obstacle_run",
  "ultra_run",
  "virtual_run",
] as const;

const RIDE_SET = new Set<string>(RIDE_TYPES);
const RUN_SET = new Set<string>(RUN_TYPES);

export function isRideType(activityType: string): boolean {
  return RIDE_SET.has(activityType) || /cycl|bik(e|ing)|_ride$/.test(activityType);
}

export function isRunType(activityType: string): boolean {
  return RUN_SET.has(activityType) || activityType.endsWith("running");
}

export function sportOf(activityType: string): Sport {
  if (isRunType(activityType)) return "run";
  if (isRideType(activityType)) return "ride";
  return "other";
}

export function isRide(activity: { activity_type: string }): boolean {
  return isRideType(activity.activity_type);
}

export function isRun(activity: { activity_type: string }): boolean {
  return isRunType(activity.activity_type);
}

/** Whether an activity belongs under a sport filter. "all" is rides and runs, not walks or strength. */
export function inSport(activity: { activity_type: string }, sport: SportFilter): boolean {
  const s = sportOf(activity.activity_type);
  return sport === "all" ? s !== "other" : s === sport;
}

export function parseSportParam(value: string | undefined): SportFilter {
  return (SPORT_KEYS as readonly string[]).includes(value ?? "") ? (value as SportFilter) : DEFAULT_SPORT;
}

/** The noun for one and several activities of a sport filter: "ride"/"rides", "workout"/"workouts". */
export const SPORT_NOUN: Record<SportFilter, { one: string; many: string }> = {
  ride: { one: "ride", many: "rides" },
  run: { one: "run", many: "runs" },
  all: { one: "workout", many: "workouts" },
};

/** "3 rides", "1 run". */
export function countOf(n: number, sport: SportFilter): string {
  return `${n} ${n === 1 ? SPORT_NOUN[sport].one : SPORT_NOUN[sport].many}`;
}

const MPH_PER_MPS = 3600 / 1609.344;

export function mph(metersPerSecond: number): number {
  return metersPerSecond * MPH_PER_MPS;
}

/** The activities under the dashboard's sport filter, in their original (oldest-first) order. */
export function activitiesFor<T extends { activity_type: string }>(data: { activities: T[]; sport: SportFilter }): T[] {
  return data.activities.filter((a) => inSport(a, data.sport));
}

/** How a sport is drawn wherever it's named: a word, a glyph (so hue is never the only cue) and
 * its color token (app/globals.css). Swimming gets an entry when it's tracked. */
export const SPORT_STYLE: Record<"ride" | "run", { label: string; glyph: string; color: string }> = {
  ride: { label: "Ride", glyph: "◆", color: "var(--sport-ride)" },
  run: { label: "Run", glyph: "●", color: "var(--sport-run)" },
};
