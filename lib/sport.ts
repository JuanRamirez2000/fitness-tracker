/**
 * Which sport an activity is, from Garmin's typeKey. Garmin's keys aren't consistent enough to
 * match on a suffix alone (road_biking, gravel_cycling, virtual_ride, e_bike_fitness), so rides
 * are an explicit list with a pattern as a fallback for keys Garmin adds later. Pure, unit-tested.
 */

/**
 * Every sport the app knows, in display order. This list drives the sport filter, the badges,
 * the per-card switches, the section layout and the summaries: a new sport is one entry here
 * plus its typeKeys, color token and section. Swimming is listed ahead of time (the owner starts
 * in January 2027); a sport with no activities stays out of every switch (sportsIn).
 */
export const SPORTS = ["ride", "run", "swim"] as const;
export type ActiveSport = (typeof SPORTS)[number];

/** The Training tab's sport filter (`?sport=`). The first is the default. */
export const SPORT_KEYS = ["all", ...SPORTS] as const;
export type SportFilter = (typeof SPORT_KEYS)[number];
export const DEFAULT_SPORT: SportFilter = "all";
export const SPORT_LABELS: Record<SportFilter, string> = { all: "All", ride: "Ride", run: "Run", swim: "Swim" };

export type Sport = ActiveSport | "other";

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

/** Garmin's swimming typeKeys (parentTypeId 26). */
export const SWIM_TYPES = ["swimming", "lap_swimming", "open_water_swimming"] as const;

const RIDE_SET = new Set<string>(RIDE_TYPES);
const RUN_SET = new Set<string>(RUN_TYPES);
const SWIM_SET = new Set<string>(SWIM_TYPES);

export function isRideType(activityType: string): boolean {
  return RIDE_SET.has(activityType) || /cycl|bik(e|ing)|_ride$/.test(activityType);
}

export function isRunType(activityType: string): boolean {
  return RUN_SET.has(activityType) || activityType.endsWith("running");
}

export function isSwimType(activityType: string): boolean {
  return SWIM_SET.has(activityType) || activityType.endsWith("swimming");
}

export function sportOf(activityType: string): Sport {
  if (isRunType(activityType)) return "run";
  if (isRideType(activityType)) return "ride";
  if (isSwimType(activityType)) return "swim";
  return "other";
}

export function isRide(activity: { activity_type: string }): boolean {
  return isRideType(activity.activity_type);
}

export function isRun(activity: { activity_type: string }): boolean {
  return isRunType(activity.activity_type);
}

export function isSwim(activity: { activity_type: string }): boolean {
  return isSwimType(activity.activity_type);
}

/** The sports with at least one activity in the list, in SPORTS order. */
export function sportsIn(activities: readonly { activity_type: string }[]): ActiveSport[] {
  const seen = new Set(activities.map((a) => sportOf(a.activity_type)));
  return SPORTS.filter((s) => seen.has(s));
}

/** Whether an activity belongs under a sport filter. "all" is every tracked sport, not walks or strength. */
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
  swim: { one: "swim", many: "swims" },
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

/** How a sport is drawn wherever it's named: a word, a glyph (so hue is never the only cue), its
 * color token (app/globals.css) and the Tailwind classes that paint with it (literal, so
 * Tailwind generates them). */
export const SPORT_STYLE: Record<
  ActiveSport,
  { label: string; glyph: string; color: string; stroke: string; fill: string; bg: string; text: string; verb: string }
> = {
  ride: { label: "Ride", glyph: "◆", color: "var(--sport-ride)", stroke: "stroke-sport-ride", fill: "fill-sport-ride", bg: "bg-sport-ride", text: "text-sport-ride", verb: "riding" },
  run: { label: "Run", glyph: "●", color: "var(--sport-run)", stroke: "stroke-sport-run", fill: "fill-sport-run", bg: "bg-sport-run", text: "text-sport-run", verb: "running" },
  swim: { label: "Swim", glyph: "▲", color: "var(--sport-swim)", stroke: "stroke-sport-swim", fill: "fill-sport-swim", bg: "bg-sport-swim", text: "text-sport-swim", verb: "swimming" },
};
