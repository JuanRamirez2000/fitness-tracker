import { isRide, isRun, onFoot, type Activity } from "@/lib/data/activities";
import type { ActivityDetail, ActivitySeries } from "@/lib/data/activity-details";
import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import type { DailyTraining } from "@/lib/data/training";
import type { Profile } from "@/lib/data/profiles";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { clockTimeIn } from "@/lib/dates/timezone";
import { trainingStatus } from "@/lib/charts/training";
import { trainingEffectWord } from "@/lib/table/activities";
import { METERS_PER_MILE, fmtDuration, fmtPace, isEasyRun, median, paceSecPerMile, runMiles, runsIn } from "@/lib/running/runs";
import { sportOf } from "@/lib/sport";

const FEET_PER_METER = 3.28084;
/** Activities of the same sport this long before are its comparison pool. */
const SIMILAR_LOOKBACK_DAYS = 120;
/** A comparable run is within this share of the activity's distance; a comparable ride, of its moving time. */
const SIMILAR_DISTANCE_SHARE = 0.35;
const MIN_SIMILAR_RUNS = 3;
/** Garmin's indoor ride types, whose speed and distance are only the trainer's estimate. */
const INDOOR_RIDES = new Set(["indoor_cycling", "virtual_ride"]);

/** The rows an activity's modal is built from (lib/activity/load.ts). */
export interface ActivityViewInput {
  activity: Activity;
  /** null: never fetched. A row with a null series: Garmin had no samples (manual activity). */
  detail: ActivityDetail | null;
  /** Every activity, oldest first: the comparison pool and the week's volume. */
  activities: Activity[];
  /** That morning's recovery row and the night that ended it (wake-up day = the activity's day). */
  recovery: DailyRecovery | null;
  sleep: SleepNight | null;
  /** Garmin's load and status going in: the day before's row. */
  trainingBefore: DailyTraining | null;
  profile: Pick<Profile, "timezone" | "hr_zone_bounds"> & Partial<Pick<Profile, "hr_zone_bounds_cycling">>;
  /** The stored AI summary, if one was written. */
  summary?: { text: string; generated_at: string } | null;
}

export interface ViewStat {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface StatGroup {
  title: string;
  stats: ViewStat[];
}

export interface SplitRow {
  mile: number;
  /** "1", or "0.42" for a last partial mile. */
  label: string;
  /** Seconds per mile. */
  pace_s: number;
  gapPace_s: number | null;
  hr: number | null;
  cadence: number | null;
  elevGainFt: number;
  elevLossFt: number;
}

/** A ride's split (every 5 miles outdoors, 5 minutes indoors), display-ready. */
export interface RideSplitRow {
  split: number;
  /** "0–5 mi", "20–25 min". */
  label: string;
  mph: number | null;
  duration: string;
  hr: number | null;
  power: number | null;
  cadence: number | null;
  elevGainFt: number;
}

export interface IntervalRow {
  label: string;
  count: number;
  miles: number | null;
  duration: string | null;
  /** "12:05/mi" for a run, "17.2 mph" for anything else. */
  speed: string | null;
  hr: number | null;
  power: number | null;
}

export interface ZoneRow {
  zone: number;
  minutes: number;
  share: number;
  low: number | null;
  high: number | null;
}

export interface ActivityContext {
  /**
   * Against runs of about this distance, or rides of about this long (indoors against indoors),
   * of the same easy/workout kind when there are enough, in the last 120 days.
   */
  similar: {
    sport: "run" | "ride";
    count: number;
    /** 1 = the fastest of them (the most powerful, for a ride with power), this one included. */
    paceRank: number;
    /** Runs: seconds per mile against their median; negative is faster. 0 for rides. */
    paceDelta_s: number;
    /** Rides: mph against their median (null indoors, where speed is the trainer's guess). */
    speedDelta_mph: number | null;
    /** Rides with power: average watts against their median. */
    powerDelta_w: number | null;
    /** Average HR against their median, bpm. */
    hrDelta: number | null;
    /** Speed per heartbeat (runs) or watts per heartbeat (rides with power) against their median, percent; positive is more efficient. */
    efficiencyPct: number | null;
    kind: "easy" | "workout" | null;
  } | null;
  load: { value: number; avg28: number | null } | null;
  /** The 7 days to this activity, in its own sport: rides for a ride, runs for anything else. */
  week: { sport: "run" | "ride"; miles: number; count: number; hours: number; milesPrior: number };
  morning: {
    readiness: number | null;
    readinessLevel: string | null;
    sleepHours: number | null;
    sleepNeedHours: number | null;
    sleepScore: number | null;
    hrv: number | null;
    hrvRange: [number, number] | null;
    restingHr: number | null;
    bodyBatteryWake: number | null;
  } | null;
  goingIn: { acute: number; chronic: number | null; ratio: number | null; status: string | null } | null;
}

export interface ActivityView {
  id: string;
  name: string;
  typeLabel: string;
  isRun: boolean;
  isRide: boolean;
  /** An indoor ride: its speed and distance are the trainer's estimate, so time is the x axis. */
  indoor: boolean;
  onFoot: boolean;
  date: LocalDate;
  startClock: string;
  location: string | null;
  kind: "easy" | "workout" | null;
  /** Garmin's primary benefit, e.g. "Tempo". */
  benefit: string | null;
  headline: ViewStat[];
  groups: StatGroup[];
  series: ActivitySeries | null;
  splits: SplitRow[];
  rideSplits: RideSplitRow[];
  intervals: IntervalRow[];
  zones: ZoneRow[] | null;
  context: ActivityContext;
  /** "missing": detail never fetched; "none": Garmin has no samples for this activity. */
  detailState: "ok" | "missing" | "none";
  summary: { text: string; generated_at: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  running: "Run",
  treadmill_running: "Treadmill run",
  trail_running: "Trail run",
  track_running: "Track run",
  indoor_running: "Indoor run",
  walking: "Walk",
  hiking: "Hike",
  cycling: "Ride",
  road_biking: "Road ride",
  mountain_biking: "Mountain bike",
  gravel_cycling: "Gravel ride",
  virtual_ride: "Virtual ride",
  indoor_cycling: "Indoor ride",
  track_cycling: "Track ride",
  cyclocross: "Cyclocross",
  e_bike_fitness: "E-bike ride",
  e_bike_mountain: "E-mountain bike",
  lap_swimming: "Pool swim",
  open_water_swimming: "Open-water swim",
  strength_training: "Strength",
};
const FEEL_WORDS: [number, string][] = [
  [100, "Very strong"],
  [75, "Strong"],
  [50, "Normal"],
  [25, "Weak"],
  [0, "Very weak"],
];
const INTERVAL_LABELS: Record<string, string> = {
  RWD_RUN: "Running",
  RWD_WALK: "Walking",
  RWD_STAND: "Standing",
  INTERVAL_WARMUP: "Warm-up",
  INTERVAL_ACTIVE: "Active",
  INTERVAL_RECOVERY: "Recovery",
  INTERVAL_REST: "Rest",
  INTERVAL_COOLDOWN: "Cool-down",
  INTERVAL_WALK: "Walk breaks",
};
/** Splits shorter than this (in total) are left out of the intervals table. */
const MIN_INTERVAL_S = 30;
/** Shown in this order: run/walk first, then a workout's structure. */
const INTERVAL_ORDER = Object.keys(INTERVAL_LABELS);

export function typeLabel(activityType: string): string {
  return TYPE_LABELS[activityType] ?? activityType.charAt(0).toUpperCase() + activityType.slice(1).replaceAll("_", " ");
}

/** Garmin's readiness level for a score: the stored level belongs to the day's latest score,
 * which isn't the one shown when the score at wake differs. */
export function readinessWord(score: number): string {
  if (score >= 95) return "Prime";
  if (score >= 75) return "High";
  if (score >= 50) return "Moderate";
  if (score >= 25) return "Low";
  return "Poor";
}

export function feelWord(feel: number): string {
  return FEEL_WORDS.find(([at]) => feel >= at - 12.5)?.[1] ?? "Very weak";
}

const titleCase = (label: string) => label.charAt(0) + label.slice(1).toLowerCase().replaceAll("_", " ");
const round1 = (v: number) => Math.round(v * 10) / 10;
const ft = (m: number) => Math.round(m * FEET_PER_METER);
const fahrenheit = (c: number) => Math.round((c * 9) / 5 + 32);
const mph = (mps: number) => round1((mps * 3600) / METERS_PER_MILE);
const signed = (v: number, digits = 0) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}`;
const present = (stats: (ViewStat | null | false)[]): ViewStat[] => stats.filter((s): s is ViewStat => !!s);

function headline(a: Activity, run: boolean): ViewStat[] {
  const moving = a.moving_duration_s ?? a.duration_s;
  const miles = (a.distance_m ?? 0) / METERS_PER_MILE;
  const ride = isRide(a);
  return present([
    miles > 0.05 && { label: "Distance", value: miles.toFixed(ride ? 1 : 2), unit: "mi" },
    { label: "Time", value: fmtDuration(moving) },
    run && a.avg_speed_mps ? { label: "Pace", value: fmtPace(paceSecPerMile(a.avg_speed_mps)), unit: "/mi" } : null,
    !run && a.avg_speed_mps && miles > 0.05 ? { label: "Speed", value: String(mph(a.avg_speed_mps)), unit: "mph" } : null,
    ride && (a.norm_power_w ?? a.avg_power_w) !== null && {
      label: a.norm_power_w !== null ? "Norm. power" : "Power",
      value: String(a.norm_power_w ?? a.avg_power_w),
      unit: "W",
    },
    a.avg_hr !== null && { label: "Avg HR", value: String(a.avg_hr), unit: "bpm" },
    a.training_load !== null && { label: "Load", value: String(Math.round(a.training_load)) },
  ]);
}

function groups(a: Activity, d: ActivityDetail | null, run: boolean): StatGroup[] {
  const moving = a.moving_duration_s ?? a.duration_s;
  const pace = (mps: number | null) => (mps ? fmtPace(paceSecPerMile(mps)) : null);
  const out: StatGroup[] = [
    {
      title: run ? "Pace and time" : "Time and speed",
      stats: present([
        { label: "Moving time", value: fmtDuration(moving) },
        a.duration_s - moving >= 60 && { label: "Elapsed", value: fmtDuration(a.duration_s) },
        run && pace(a.avg_speed_mps) ? { label: "Avg pace", value: pace(a.avg_speed_mps)!, unit: "/mi" } : null,
        run && pace(a.avg_grade_adjusted_speed_mps)
          ? { label: "Grade-adjusted", value: pace(a.avg_grade_adjusted_speed_mps)!, unit: "/mi" }
          : null,
        run && a.fastest_mile_s !== null && { label: "Fastest mile", value: fmtPace(a.fastest_mile_s) },
        run && pace(a.max_speed_mps) ? { label: "Top speed", value: pace(a.max_speed_mps)!, unit: "/mi" } : null,
        !run && a.max_speed_mps ? { label: "Top speed", value: String(mph(a.max_speed_mps)), unit: "mph" } : null,
      ]),
    },
    {
      title: "Heart",
      stats: present([
        a.avg_hr !== null && { label: "Average", value: String(a.avg_hr), unit: "bpm" },
        a.max_hr !== null && { label: "Max", value: String(a.max_hr), unit: "bpm" },
        d?.min_hr != null && { label: "Min", value: String(d.min_hr), unit: "bpm" },
      ]),
    },
    {
      title: "Effort",
      stats: present([
        a.training_load !== null && { label: "Training load", value: String(Math.round(a.training_load)) },
        a.aerobic_training_effect !== null && {
          label: "Aerobic effect",
          value: a.aerobic_training_effect.toFixed(1),
          note: trainingEffectWord(a.aerobic_training_effect),
        },
        a.anaerobic_training_effect !== null && {
          label: "Anaerobic effect",
          value: a.anaerobic_training_effect.toFixed(1),
          note: trainingEffectWord(a.anaerobic_training_effect),
        },
        d?.workout_feel != null && { label: "Feel", value: feelWord(d.workout_feel), note: "as you logged it" },
        d?.workout_rpe != null && { label: "Effort (RPE)", value: String(Math.round(d.workout_rpe / 10)), unit: "/ 10" },
        a.body_battery_change !== null && { label: "Body Battery", value: signed(a.body_battery_change) },
        d?.stamina_start != null && d.stamina_end != null && {
          label: "Stamina",
          value: `${d.stamina_start}→${d.stamina_end}`,
          unit: "%",
        },
        a.calories !== null && { label: "Calories", value: String(a.calories) },
      ]),
    },
  ];
  if (run) {
    out.push({
      title: "Running form",
      stats: present([
        a.avg_cadence_spm !== null && { label: "Cadence", value: String(Math.round(a.avg_cadence_spm)), unit: "spm" },
        a.avg_stride_cm !== null && { label: "Stride", value: (a.avg_stride_cm / 100).toFixed(2), unit: "m" },
        a.avg_ground_contact_ms !== null && { label: "Ground contact", value: String(Math.round(a.avg_ground_contact_ms)), unit: "ms" },
        a.avg_vertical_oscillation_cm !== null && { label: "Vertical osc.", value: a.avg_vertical_oscillation_cm.toFixed(1), unit: "cm" },
        a.avg_vertical_ratio !== null && { label: "Vertical ratio", value: a.avg_vertical_ratio.toFixed(1), unit: "%" },
        a.avg_power_w !== null && {
          label: "Power",
          value: String(a.avg_power_w),
          unit: "W",
          note: a.norm_power_w !== null ? `${a.norm_power_w} W normalized` : undefined,
        },
        a.steps !== null && { label: "Steps", value: a.steps.toLocaleString("en-US") },
      ]),
    });
  } else if (a.avg_power_w !== null || a.avg_cadence_rpm !== null) {
    out.push({
      title: "Power and cadence",
      stats: present([
        a.avg_power_w !== null && { label: "Avg power", value: String(a.avg_power_w), unit: "W" },
        a.norm_power_w !== null && { label: "Normalized", value: String(a.norm_power_w), unit: "W" },
        a.max_power_w !== null && { label: "Max power", value: String(a.max_power_w), unit: "W" },
        a.max_20min_power_w !== null && { label: "Best 20 min", value: String(a.max_20min_power_w), unit: "W" },
        a.intensity_factor !== null && { label: "Intensity factor", value: a.intensity_factor.toFixed(2), note: "against Garmin’s FTP" },
        a.training_stress_score !== null && { label: "TSS", value: String(Math.round(a.training_stress_score)) },
        a.avg_cadence_rpm !== null && {
          label: "Cadence",
          value: String(Math.round(a.avg_cadence_rpm)),
          unit: "rpm",
          note: a.max_cadence_rpm !== null ? `max ${a.max_cadence_rpm}` : undefined,
        },
      ]),
    });
  }
  out.push({
    title: "Conditions",
    stats: present([
      a.elevation_gain_m !== null && { label: "Climb", value: String(ft(a.elevation_gain_m)), unit: "ft" },
      a.elevation_loss_m !== null && { label: "Descent", value: String(ft(a.elevation_loss_m)), unit: "ft" },
      a.min_temp_c !== null && a.max_temp_c !== null && {
        label: "Temperature",
        value: a.min_temp_c === a.max_temp_c ? `${fahrenheit(a.min_temp_c)}` : `${fahrenheit(a.min_temp_c)}–${fahrenheit(a.max_temp_c)}`,
        unit: "°F",
        note: "at the watch",
      },
    ]),
  });
  return out.filter((g) => g.stats.length > 0);
}

function splits(d: ActivityDetail | null): SplitRow[] {
  return (d?.mile_splits ?? [])
    .filter((m) => m.distance_m > 0 && m.duration_s > 0)
    .map((m) => {
      const miles = m.distance_m / METERS_PER_MILE;
      return {
        mile: m.mile,
        label: miles > 0.98 ? String(m.mile) : miles.toFixed(2),
        pace_s: m.duration_s / miles,
        gapPace_s: m.avg_gap_mps ? paceSecPerMile(m.avg_gap_mps) : null,
        hr: m.avg_hr,
        cadence: m.avg_cadence_spm,
        elevGainFt: ft(m.elevation_gain_m),
        elevLossFt: ft(m.elevation_loss_m),
      };
    });
}

function rideSplits(d: ActivityDetail | null): RideSplitRow[] {
  return (d?.ride_splits ?? [])
    .filter((s) => s.duration_s > 0)
    .map((s, i, all) => {
      const time = s.by === "time";
      const size = 5; // miles or minutes
      const start = i * size;
      // The last split may be partial: label it by where it really ended.
      const end = i === all.length - 1 ? (time ? start + Math.round(s.duration_s / 60) : round1(start + s.distance_m / METERS_PER_MILE)) : start + size;
      return {
        split: s.split,
        label: `${start}–${end} ${time ? "min" : "mi"}`,
        mph: s.distance_m > 0 ? mph(s.distance_m / s.duration_s) : null,
        duration: fmtDuration(s.duration_s),
        hr: s.avg_hr,
        power: s.avg_power_w,
        cadence: s.avg_cadence_rpm,
        elevGainFt: ft(s.elevation_gain_m),
      };
    });
}

function intervals(d: ActivityDetail | null, run: boolean): IntervalRow[] {
  const rows = d?.interval_splits ?? [];
  // Garmin repeats the whole activity as one INTERVAL_ACTIVE split when there was no structured
  // workout; it adds nothing to the table.
  const structured = rows.filter((r) => r.type !== "INTERVAL_ACTIVE" || rows.some((o) => o.type === "INTERVAL_WARMUP" || o.type === "INTERVAL_RECOVERY"));
  // A few-second "cool-down" is the watch closing the workout, not a segment.
  const known = structured.filter((r) => INTERVAL_LABELS[r.type] && (r.duration_s ?? 0) >= MIN_INTERVAL_S);
  if (known.length < 2) return [];
  return known
    .sort((x, y) => INTERVAL_ORDER.indexOf(x.type) - INTERVAL_ORDER.indexOf(y.type))
    .map((r) => ({
      label: INTERVAL_LABELS[r.type],
      count: r.count,
      miles: r.distance_m !== null ? r.distance_m / METERS_PER_MILE : null,
      duration: r.duration_s !== null ? fmtDuration(r.duration_s) : null,
      speed:
        r.avg_speed_mps && r.avg_speed_mps > 0.5
          ? run
            ? `${fmtPace(paceSecPerMile(r.avg_speed_mps))}/mi`
            : `${mph(r.avg_speed_mps)} mph`
          : null,
      hr: r.avg_hr,
      power: r.avg_power_w,
    }));
}

function zones(a: Activity, bounds: [number, number][] | null): ZoneRow[] | null {
  if (!a.hr_zone_s) return null;
  const total = a.hr_zone_s.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  return a.hr_zone_s.map((s, i) => ({
    zone: i + 1,
    minutes: s / 60,
    share: s / total,
    low: bounds?.[i]?.[0] ?? null,
    high: bounds?.[i]?.[1] ?? null,
  }));
}

const kindOf = (a: Activity) => (a.training_effect_label === null ? null : isEasyRun(a) ? ("easy" as const) : ("workout" as const));

/** The pool to compare against: same kind (easy or workout) when there are enough, else all of them; null when too few. */
function comparable(pool: Activity[], kind: "easy" | "workout" | null): { items: Activity[]; kind: "easy" | "workout" | null } | null {
  const sameKind = kind ? pool.filter((r) => kindOf(r) === kind) : [];
  if (sameKind.length >= MIN_SIMILAR_RUNS) return { items: sameKind, kind };
  return pool.length >= MIN_SIMILAR_RUNS ? { items: pool, kind: null } : null;
}

function similarRun(a: Activity, all: Activity[]): ActivityContext["similar"] {
  if (!a.avg_speed_mps || !a.distance_m) return null;
  const pool = runsIn(all.filter(isRun), { from: addDays(a.local_date, -SIMILAR_LOOKBACK_DAYS), to: a.local_date }).filter(
    (r) =>
      r.id !== a.id &&
      r.started_at < a.started_at &&
      r.avg_speed_mps &&
      r.distance_m &&
      Math.abs(r.distance_m - a.distance_m!) <= a.distance_m! * SIMILAR_DISTANCE_SHARE,
  );
  const picked = comparable(pool, kindOf(a));
  if (!picked) return null;
  const runs = picked.items;

  const pace = (r: Activity) => paceSecPerMile(r.avg_speed_mps!);
  const myPace = pace(a);
  const medPace = median(runs.map(pace))!;
  const medHr = median(runs.flatMap((r) => (r.avg_hr ? [r.avg_hr] : [])));
  const eff = (r: Activity) => (r.avg_hr ? r.avg_speed_mps! / r.avg_hr : null);
  const medEff = median(runs.flatMap((r) => (eff(r) !== null ? [eff(r)!] : [])));
  const myEff = eff(a);
  return {
    sport: "run",
    count: runs.length,
    paceRank: runs.filter((r) => pace(r) < myPace).length + 1,
    paceDelta_s: Math.round(myPace - medPace),
    speedDelta_mph: null,
    powerDelta_w: null,
    hrDelta: a.avg_hr && medHr !== null ? Math.round(a.avg_hr - medHr) : null,
    efficiencyPct: myEff !== null && medEff ? round1(((myEff - medEff) / medEff) * 100) : null,
    kind: picked.kind,
  };
}

/**
 * A ride against rides of about the same moving time, indoors against indoors: an indoor
 * ride's speed is the trainer's guess, so it's ranked by power, and an outdoor one by power
 * when both have it, else speed. Efficiency is watts per heartbeat, which terrain and wind
 * don't skew the way speed per heartbeat would.
 */
function similarRide(a: Activity, all: Activity[]): ActivityContext["similar"] {
  const indoor = INDOOR_RIDES.has(a.activity_type);
  const moving = (r: Activity) => r.moving_duration_s ?? r.duration_s;
  const pool = runsIn(all.filter(isRide), { from: addDays(a.local_date, -SIMILAR_LOOKBACK_DAYS), to: a.local_date }).filter(
    (r) =>
      r.id !== a.id &&
      r.started_at < a.started_at &&
      INDOOR_RIDES.has(r.activity_type) === indoor &&
      Math.abs(moving(r) - moving(a)) <= moving(a) * SIMILAR_DISTANCE_SHARE,
  );
  const usePower = a.avg_power_w !== null;
  const measured = pool.filter((r) => (usePower ? r.avg_power_w !== null : !indoor && r.avg_speed_mps));
  if (!usePower && (indoor || !a.avg_speed_mps)) return null;
  const picked = comparable(measured, kindOf(a));
  if (!picked) return null;
  const rides = picked.items;

  const score = (r: Activity) => (usePower ? r.avg_power_w! : r.avg_speed_mps!);
  const medPower = usePower ? median(rides.map((r) => r.avg_power_w!)) : null;
  const speeds = rides.flatMap((r) => (r.avg_speed_mps ? [r.avg_speed_mps] : []));
  const medSpeed = !indoor && a.avg_speed_mps ? median(speeds) : null;
  const medHr = median(rides.flatMap((r) => (r.avg_hr ? [r.avg_hr] : [])));
  const eff = (r: Activity) => (r.avg_hr && r.avg_power_w !== null ? r.avg_power_w / r.avg_hr : null);
  const medEff = median(rides.flatMap((r) => (eff(r) !== null ? [eff(r)!] : [])));
  const myEff = eff(a);
  return {
    sport: "ride",
    count: rides.length,
    paceRank: rides.filter((r) => score(r) > score(a)).length + 1,
    paceDelta_s: 0,
    speedDelta_mph: medSpeed !== null ? round1(mph(a.avg_speed_mps!) - mph(medSpeed)) : null,
    powerDelta_w: medPower !== null ? Math.round(a.avg_power_w! - medPower) : null,
    hrDelta: a.avg_hr && medHr !== null ? Math.round(a.avg_hr - medHr) : null,
    efficiencyPct: myEff !== null && medEff ? round1(((myEff - medEff) / medEff) * 100) : null,
    kind: picked.kind,
  };
}

function similar(a: Activity, all: Activity[]): ActivityContext["similar"] {
  if (isRun(a)) return similarRun(a, all);
  if (isRide(a)) return similarRide(a, all);
  return null;
}

function context(input: ActivityViewInput): ActivityContext {
  const { activity: a, activities, recovery: r, sleep: s, trainingBefore: t } = input;
  const day = a.local_date;
  const prior = activities.filter((x) => x.id !== a.id && x.local_date < day && x.local_date >= addDays(day, -28) && x.training_load !== null);
  // The week in this activity's own sport: rides for a ride, runs for a run or anything else.
  const weekSport = sportOf(a.activity_type) === "ride" ? "ride" : "run";
  const same = activities.filter((x) => sportOf(x.activity_type) === weekSport);
  const week = runsIn(same, { from: addDays(day, -6), to: day });
  const priorWeek = runsIn(same, { from: addDays(day, -13), to: addDays(day, -7) });

  const readiness = r?.readiness_morning_score ?? r?.readiness_score ?? null;
  const morning =
    r || s
      ? {
          readiness,
          readinessLevel: readiness !== null ? readinessWord(readiness) : null,
          sleepHours: s?.duration_s ? round1(s.duration_s / 3600) : null,
          sleepNeedHours: s?.need_s ? round1(s.need_s / 3600) : null,
          sleepScore: s?.score ?? null,
          hrv: r?.hrv_ms ?? null,
          hrvRange: r?.hrv_baseline_low != null && r.hrv_baseline_high != null ? ([r.hrv_baseline_low, r.hrv_baseline_high] as [number, number]) : null,
          restingHr: r?.resting_hr ?? null,
          bodyBatteryWake: r?.body_battery_wake ?? null,
        }
      : null;

  return {
    similar: similar(a, activities),
    load:
      a.training_load !== null
        ? {
            value: Math.round(a.training_load),
            avg28: prior.length ? Math.round(prior.reduce((sum, x) => sum + x.training_load!, 0) / prior.length) : null,
          }
        : null,
    week: {
      sport: weekSport,
      miles: round1(week.reduce((sum, x) => sum + runMiles(x), 0)),
      count: week.length,
      hours: round1(week.reduce((sum, x) => sum + (x.moving_duration_s ?? x.duration_s), 0) / 3600),
      milesPrior: round1(priorWeek.reduce((sum, x) => sum + runMiles(x), 0)),
    },
    morning,
    goingIn:
      t?.acute_load != null && t.local_date >= addDays(day, -2)
        ? { acute: t.acute_load, chronic: t.chronic_load, ratio: t.acwr, status: trainingStatus(t.status)?.label ?? null }
        : null,
  };
}

/** Everything the activity modal shows, display-ready and serializable. Pure, unit-tested. */
export function buildActivityView(input: ActivityViewInput): ActivityView {
  const { activity: a, detail: d } = input;
  const run = isRun(a);
  const ride = isRide(a);
  const bounds = ride ? input.profile.hr_zone_bounds_cycling ?? input.profile.hr_zone_bounds : input.profile.hr_zone_bounds;
  return {
    id: a.id,
    name: a.name ?? typeLabel(a.activity_type),
    typeLabel: typeLabel(a.activity_type),
    isRun: run,
    isRide: ride,
    indoor: INDOOR_RIDES.has(a.activity_type),
    onFoot: onFoot(a.activity_type),
    date: a.local_date,
    startClock: clockTimeIn(a.started_at, input.profile.timezone),
    location: d?.location_name ?? null,
    kind: run || ride ? kindOf(a) : null,
    benefit: a.training_effect_label ? titleCase(a.training_effect_label) : null,
    headline: headline(a, run),
    groups: groups(a, d, run),
    series: d?.series ?? null,
    splits: splits(d),
    rideSplits: rideSplits(d),
    intervals: intervals(d, run),
    zones: zones(a, bounds),
    context: context(input),
    detailState: !d ? "missing" : d.series ? "ok" : "none",
    summary: input.summary ?? null,
  };
}

/** Pace in seconds per mile from a series speed, or null while stopped or walking very slowly. */
export function paceOf(speedMps: number | null): number | null {
  return speedMps !== null && speedMps > 0.7 ? paceSecPerMile(speedMps) : null;
}

/** "−0:12" / "+0:05" for a pace difference in seconds. */
export function fmtPaceDelta(seconds: number): string {
  return `${seconds < 0 ? "−" : "+"}${fmtPace(Math.abs(seconds))}`;
}

export { signed as fmtSigned };
