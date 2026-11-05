import { isRun, onFoot, type Activity } from "@/lib/data/activities";
import type { ActivityDetail, ActivitySeries } from "@/lib/data/activity-details";
import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import type { DailyTraining } from "@/lib/data/training";
import type { Profile } from "@/lib/data/profiles";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { clockTimeIn } from "@/lib/dates/timezone";
import { trainingStatus } from "@/lib/charts/training";
import { trainingEffectWord } from "@/lib/table/runs";
import { METERS_PER_MILE, fmtDuration, fmtPace, isEasyRun, median, paceSecPerMile, runMiles, runsIn, runsOf } from "@/lib/running/runs";

const FEET_PER_METER = 3.28084;
/** Runs this long before the activity are its comparison pool. */
const SIMILAR_LOOKBACK_DAYS = 120;
/** A comparable run is within this share of the activity's distance. */
const SIMILAR_DISTANCE_SHARE = 0.35;
const MIN_SIMILAR_RUNS = 3;

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
  profile: Pick<Profile, "timezone" | "hr_zone_bounds">;
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

export interface IntervalRow {
  label: string;
  count: number;
  miles: number | null;
  duration: string | null;
  pace: string | null;
  hr: number | null;
}

export interface ZoneRow {
  zone: number;
  minutes: number;
  share: number;
  low: number | null;
  high: number | null;
}

export interface ActivityContext {
  /** Against runs of about this distance (and the same easy/workout kind) in the last 120 days. */
  similar: {
    count: number;
    /** 1 = the fastest of them, this one included. */
    paceRank: number;
    /** Seconds per mile against their median; negative is faster. */
    paceDelta_s: number;
    /** Average HR against their median, bpm. */
    hrDelta: number | null;
    /** Speed per heartbeat against their median, percent; positive is more efficient. */
    efficiencyPct: number | null;
    kind: "easy" | "workout" | null;
  } | null;
  load: { value: number; avg28: number | null } | null;
  week: { miles: number; runs: number; milesPrior: number };
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
  virtual_ride: "Virtual ride",
  indoor_cycling: "Indoor ride",
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
  return present([
    miles > 0.05 && { label: "Distance", value: miles.toFixed(2), unit: "mi" },
    { label: "Time", value: fmtDuration(moving) },
    run && a.avg_speed_mps ? { label: "Pace", value: fmtPace(paceSecPerMile(a.avg_speed_mps)), unit: "/mi" } : null,
    !run && a.avg_speed_mps && miles > 0.05 ? { label: "Speed", value: String(mph(a.avg_speed_mps)), unit: "mph" } : null,
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
  } else if (a.avg_power_w !== null || a.avg_cadence_spm !== null) {
    out.push({
      title: "Output",
      stats: present([
        a.avg_power_w !== null && { label: "Power", value: String(a.avg_power_w), unit: "W" },
        a.norm_power_w !== null && { label: "Normalized", value: String(a.norm_power_w), unit: "W" },
        a.avg_cadence_spm !== null && { label: "Cadence", value: String(Math.round(a.avg_cadence_spm)), unit: "rpm" },
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

function intervals(d: ActivityDetail | null): IntervalRow[] {
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
      pace: r.avg_speed_mps && r.avg_speed_mps > 0.5 ? fmtPace(paceSecPerMile(r.avg_speed_mps)) : null,
      hr: r.avg_hr,
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

function similar(a: Activity, all: Activity[]): ActivityContext["similar"] {
  if (!isRun(a) || !a.avg_speed_mps || !a.distance_m) return null;
  const kind = a.training_effect_label === null ? null : isEasyRun(a) ? "easy" : "workout";
  const pool = runsIn(runsOf(all), { from: addDays(a.local_date, -SIMILAR_LOOKBACK_DAYS), to: a.local_date }).filter(
    (r) =>
      r.id !== a.id &&
      r.started_at < a.started_at &&
      r.avg_speed_mps &&
      r.distance_m &&
      Math.abs(r.distance_m - a.distance_m!) <= a.distance_m! * SIMILAR_DISTANCE_SHARE,
  );
  const sameKind = kind ? pool.filter((r) => (r.training_effect_label === null ? null : isEasyRun(r) ? "easy" : "workout") === kind) : [];
  const runs = sameKind.length >= MIN_SIMILAR_RUNS ? sameKind : pool;
  if (runs.length < MIN_SIMILAR_RUNS) return null;

  const pace = (r: Activity) => paceSecPerMile(r.avg_speed_mps!);
  const myPace = pace(a);
  const medPace = median(runs.map(pace))!;
  const hrs = runs.flatMap((r) => (r.avg_hr ? [r.avg_hr] : []));
  const medHr = median(hrs);
  const eff = (r: Activity) => (r.avg_hr ? r.avg_speed_mps! / r.avg_hr : null);
  const effs = runs.flatMap((r) => (eff(r) !== null ? [eff(r)!] : []));
  const medEff = median(effs);
  const myEff = eff(a);
  return {
    count: runs.length,
    paceRank: runs.filter((r) => pace(r) < myPace).length + 1,
    paceDelta_s: Math.round(myPace - medPace),
    hrDelta: a.avg_hr && medHr !== null ? Math.round(a.avg_hr - medHr) : null,
    efficiencyPct: myEff !== null && medEff ? round1(((myEff - medEff) / medEff) * 100) : null,
    kind: runs === sameKind ? kind : null,
  };
}

function context(input: ActivityViewInput): ActivityContext {
  const { activity: a, activities, recovery: r, sleep: s, trainingBefore: t } = input;
  const day = a.local_date;
  const prior = activities.filter((x) => x.id !== a.id && x.local_date < day && x.local_date >= addDays(day, -28) && x.training_load !== null);
  const runs = runsOf(activities);
  const week = runsIn(runs, { from: addDays(day, -6), to: day });
  const priorWeek = runsIn(runs, { from: addDays(day, -13), to: addDays(day, -7) });

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
      miles: round1(week.reduce((sum, x) => sum + runMiles(x), 0)),
      runs: week.length,
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
  return {
    id: a.id,
    name: a.name ?? typeLabel(a.activity_type),
    typeLabel: typeLabel(a.activity_type),
    isRun: run,
    onFoot: onFoot(a.activity_type),
    date: a.local_date,
    startClock: clockTimeIn(a.started_at, input.profile.timezone),
    location: d?.location_name ?? null,
    kind: run && a.training_effect_label !== null ? (isEasyRun(a) ? "easy" : "workout") : null,
    benefit: a.training_effect_label ? titleCase(a.training_effect_label) : null,
    headline: headline(a, run),
    groups: groups(a, d, run),
    series: d?.series ?? null,
    splits: splits(d),
    intervals: intervals(d),
    zones: zones(a, input.profile.hr_zone_bounds),
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
