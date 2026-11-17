import type { DashboardData } from "@/lib/dashboard/types";
import { isRide, isRun, type Activity } from "@/lib/data/activities";
import type { MileSplit } from "@/lib/data/activity-details";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { METERS_PER_MILE, median, paceSecPerMile, runMiles, runSpeedMps } from "@/lib/running/runs";

/**
 * Bricks: a run that starts within BRICK_GAP_S of a ride ending, indoors or out. Timing alone
 * pairs them, so a Garmin multisport activity (its legs arrive as back-to-back activities, with
 * any transition between them) counts the same way as two separate recordings. Pure.
 */
export const BRICK_GAP_S = 15 * 60;

/** Garmin's start and end times can overlap by a few seconds when one activity follows another. */
const OVERLAP_S = 120;

/** Fresh runs: the 90 days before a brick, within this many bpm of its average heart rate (pace is
 * scaled per heartbeat, so a few bpm either side compares fairly). */
const FRESH_DAYS = 90;
const FRESH_HR_BAND = 10;
const MIN_FRESH_RUNS = 3;
/** Shorter runs are too noisy to stand for "a fresh run". */
const MIN_FRESH_MILES = 1;

/** Runs shorter than this compare their first 5 minutes against the rest instead of the first mile. */
const MILE_DROP_MIN_MILES = 1.5;
const OPENING_S = 5 * 60;
/** At least this much running after the opening, for "the rest" to mean anything. */
const MIN_REST_S = 3 * 60;

export interface BrickPair {
  ride: Activity;
  run: Activity;
  /** Seconds from the ride's end to the run's start (the transition); 0 when they overlap. */
  gapS: number;
}

const INDOOR_RUNS = new Set(["treadmill_running", "indoor_running"]);
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

export interface OffBikeCost {
  /** The brick run's pace, seconds per mile (grade-adjusted when Garmin has it). */
  pace: number;
  /** What fresh runs averaged at the brick run's heart rate, seconds per mile. */
  freshPace: number;
  /** pace − freshPace: positive is slower off the bike. */
  costS: number;
  freshRuns: number;
}

/**
 * The run's pace against fresh runs at the same effort: the median speed per heartbeat of runs
 * in the FRESH_DAYS before it, within FRESH_HR_BAND bpm and indoors-with-indoors, scaled to the
 * brick run's heart rate. Null without heart rate or MIN_FRESH_RUNS such runs.
 */
export function offBikeCost(run: Activity, activities: readonly Activity[], brickRunIds: ReadonlySet<string>): OffBikeCost | null {
  const speed = runSpeedMps(run);
  if (!speed || !run.avg_hr) return null;
  const indoor = INDOOR_RUNS.has(run.activity_type);
  const from = addDays(run.local_date, -FRESH_DAYS);
  const perBeat = activities
    .filter(
      (a) =>
        isRun(a) &&
        !brickRunIds.has(a.id) &&
        a.local_date >= from &&
        a.started_at < run.started_at &&
        INDOOR_RUNS.has(a.activity_type) === indoor &&
        runMiles(a) >= MIN_FRESH_MILES &&
        a.avg_hr !== null &&
        Math.abs(a.avg_hr - run.avg_hr!) <= FRESH_HR_BAND,
    )
    .flatMap((a) => {
      const s = runSpeedMps(a);
      return s ? [s / a.avg_hr!] : [];
    });
  if (perBeat.length < MIN_FRESH_RUNS) return null;
  const pace = paceSecPerMile(speed);
  const freshPace = paceSecPerMile(median(perBeat)! * run.avg_hr);
  return { pace, freshPace, costS: pace - freshPace, freshRuns: perBeat.length };
}

/** The parts of a run's detail the drop needs (lib/data/queries.ts fetchBrickRunDetails). */
export interface BrickRunDetail {
  activity_id: string;
  mile_splits: MileSplit[] | null;
  /** The series' timer seconds and meters, index for index. */
  t: number[] | null;
  d: (number | null)[] | null;
}

export interface FirstMileDrop {
  /** "mile": the first mile against the rest; "opening": the first 5 minutes (short runs). */
  by: "mile" | "opening";
  /** Seconds per mile. */
  firstPace: number;
  restPace: number;
  /** firstPace − restPace: positive means the opening was slower (legs still on the bike). */
  dropS: number;
}

/** How much slower the opening of a run was than the rest, from its splits or its samples. */
export function firstMileDrop(detail: BrickRunDetail | undefined, miles: number): FirstMileDrop | null {
  if (!detail) return null;
  const splits = detail.mile_splits ?? [];
  if (miles >= MILE_DROP_MIN_MILES && splits.length >= 2 && splits[0].distance_m > 0) {
    const [first, ...rest] = splits;
    const restM = rest.reduce((s, x) => s + x.distance_m, 0);
    const restS = rest.reduce((s, x) => s + x.duration_s, 0);
    if (restM <= 0 || restS <= 0) return null;
    const firstPace = (first.duration_s / first.distance_m) * METERS_PER_MILE;
    const restPace = (restS / restM) * METERS_PER_MILE;
    return { by: "mile", firstPace, restPace, dropS: firstPace - restPace };
  }
  const { t, d } = detail;
  if (!t?.length || !d?.length) return null;
  const at = (i: number) => d[i] ?? null;
  const cut = t.findIndex((s) => s >= OPENING_S);
  const last = t.length - 1;
  if (cut <= 0 || t[last] - t[cut] < MIN_REST_S) return null;
  const d0 = at(0) ?? 0;
  const dCut = at(cut);
  const dEnd = at(last);
  if (dCut === null || dEnd === null || dCut <= d0 || dEnd <= dCut) return null;
  const firstPace = ((t[cut] - t[0]) / (dCut - d0)) * METERS_PER_MILE;
  const restPace = ((t[last] - t[cut]) / (dEnd - dCut)) * METERS_PER_MILE;
  return { by: "opening", firstPace, restPace, dropS: firstPace - restPace };
}

export interface BrickRow {
  date: LocalDate;
  ride: Activity;
  run: Activity;
  gapS: number;
  rideMinutes: number;
  runMiles: number;
  cost: OffBikeCost | null;
  drop: FirstMileDrop | null;
}

export interface BrickSummary {
  /** Bricks in the range, newest first. */
  rows: BrickRow[];
  /** Every brick ever (the card stays hidden until the first). */
  total: number;
  /** The newest brick before the range, for "last one Jun 28" when the range has none. */
  lastBefore: LocalDate | null;
  /** Means over the range's bricks that have each number. */
  avgCostS: number | null;
  avgDropS: number | null;
  avgGapS: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** The brick card's rows and averages, or null before the first brick. Pure. */
export function buildBricks(data: Pick<DashboardData, "activities" | "brickRuns" | "dateRange">): BrickSummary | null {
  const bricks = findBricks(data.activities);
  if (!bricks.length) return null;
  const runIds = new Set(bricks.map((b) => b.run.id));
  const details = new Map(data.brickRuns.map((d) => [d.activity_id, d]));
  const rows: BrickRow[] = bricks
    .filter((b) => isInRange(b.run.local_date, data.dateRange))
    .map((b) => ({
      date: b.run.local_date,
      ride: b.ride,
      run: b.run,
      gapS: b.gapS,
      rideMinutes: Math.round((b.ride.moving_duration_s ?? b.ride.duration_s) / 60),
      runMiles: runMiles(b.run),
      cost: offBikeCost(b.run, data.activities, runIds),
      drop: firstMileDrop(details.get(b.run.id), runMiles(b.run)),
    }))
    .reverse();
  const before = bricks.filter((b) => b.run.local_date < data.dateRange.from).at(-1);
  return {
    rows,
    total: bricks.length,
    lastBefore: before?.run.local_date ?? null,
    avgCostS: mean(rows.flatMap((r) => (r.cost ? [r.cost.costS] : []))),
    avgDropS: mean(rows.flatMap((r) => (r.drop ? [r.drop.dropS] : []))),
    avgGapS: mean(rows.map((r) => r.gapS)),
  };
}
