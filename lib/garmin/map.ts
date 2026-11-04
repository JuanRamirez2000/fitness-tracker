/**
 * Garmin Personal API responses → database rows. Pure, so it's unit-tested
 * (map.test.ts). Only the fields the app stores are typed.
 */

export const GRAMS_PER_LB = 453.59237;

export interface RawWeighIn {
  samplePk?: number | null;
  calendarDate?: string | null;
  timestampGMT?: number | null;
  weight?: number | null; // grams
  bodyFat?: number | null; // %
  bodyWater?: number | null; // %
  muscleMass?: number | null; // grams
  boneMass?: number | null; // grams
}

export interface RawStepsDay {
  calendarDate: string;
  totalSteps?: number | null;
}

export interface RawActivity {
  activityId?: number | null;
  activityName?: string | null;
  activityType?: { typeKey?: string | null } | null;
  startTimeLocal?: string | null; // "YYYY-MM-DD HH:MM:SS"
  startTimeGMT?: string | null; // "YYYY-MM-DD HH:MM:SS"
  duration?: number | null;
  movingDuration?: number | null;
  distance?: number | null;
  elevationGain?: number | null;
  averageSpeed?: number | null;
  avgGradeAdjustedSpeed?: number | null;
  averageHR?: number | null;
  maxHR?: number | null;
  averageRunningCadenceInStepsPerMinute?: number | null;
  avgStrideLength?: number | null;
  avgGroundContactTime?: number | null;
  calories?: number | null;
  aerobicTrainingEffect?: number | null;
  trainingEffectLabel?: string | null;
  activityTrainingLoad?: number | null;
  vO2MaxValue?: number | null;
  fastestSplit_1609?: number | null;
  hrTimeInZone_1?: number | null; // seconds
  hrTimeInZone_2?: number | null;
  hrTimeInZone_3?: number | null;
  hrTimeInZone_4?: number | null;
  hrTimeInZone_5?: number | null;
}

/** One sport's zones from /biometric-service/heartRateZones/v2. */
export interface RawHrZones {
  sport?: string | null;
  zone1Floor?: number | null;
  zone2Floor?: number | null;
  zone3Floor?: number | null;
  zone4Floor?: number | null;
  zone5Floor?: number | null;
  maxHeartRateUsed?: number | null;
}

export interface WeighInRow {
  measured_at: string;
  local_date: string;
  weight_lb: number;
  external_id: string;
  body_fat_pct: number | null;
  muscle_mass_lb: number | null;
  bone_mass_lb: number | null;
  body_water_pct: number | null;
}

/** The weigh_ins columns the import writes besides user_id, source and external_id. */
export const WEIGH_IN_COLUMNS = [
  "measured_at", "local_date", "weight_lb", "body_fat_pct", "muscle_mass_lb", "bone_mass_lb", "body_water_pct",
] as const satisfies readonly (keyof WeighInRow)[];

export interface StepsRow {
  local_date: string;
  steps: number;
}

export interface ActivityRow {
  external_id: string;
  activity_type: string;
  name: string | null;
  started_at: string;
  local_date: string;
  duration_s: number;
  moving_duration_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  avg_speed_mps: number | null;
  avg_grade_adjusted_speed_mps: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence_spm: number | null;
  avg_stride_cm: number | null;
  avg_ground_contact_ms: number | null;
  calories: number | null;
  aerobic_training_effect: number | null;
  training_effect_label: string | null;
  training_load: number | null;
  vo2max: number | null;
  fastest_mile_s: number | null;
  /** [z1..z5] seconds in each HR zone, or null when the activity has no HR. */
  hr_zone_s: number[] | null;
}

/** Every activities column the importer writes, besides user_id, source and external_id. */
export const ACTIVITY_COLUMNS = [
  "activity_type", "name", "started_at", "local_date", "duration_s", "moving_duration_s", "distance_m",
  "elevation_gain_m", "avg_speed_mps", "avg_grade_adjusted_speed_mps", "avg_hr", "max_hr", "avg_cadence_spm",
  "avg_stride_cm", "avg_ground_contact_ms", "calories", "aerobic_training_effect", "training_effect_label",
  "training_load", "vo2max", "fastest_mile_s", "hr_zone_s",
] as const satisfies readonly (keyof ActivityRow)[];

const roundOrNull = (value: number | null | undefined) => (value ? Math.round(value) : null);
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
const orNull = <T>(value: T | null | undefined): T | null => value ?? null;

export function buildWeighInRows(entries: RawWeighIn[], warn: (msg: string) => void = () => {}): WeighInRow[] {
  const rows: WeighInRow[] = [];
  for (const e of entries) {
    if (e.samplePk == null || !e.calendarDate || e.timestampGMT == null || e.weight == null) continue;
    const weightLb = Math.round((e.weight / GRAMS_PER_LB) * 10) / 10;
    if (weightLb < 50 || weightLb > 800) {
      warn(`skipping an out-of-range weigh-in (${weightLb} lb on ${e.calendarDate})`);
      continue;
    }
    rows.push({
      measured_at: new Date(e.timestampGMT).toISOString(),
      local_date: e.calendarDate,
      weight_lb: weightLb,
      external_id: String(e.samplePk),
      body_fat_pct: e.bodyFat ? round1(e.bodyFat) : null,
      muscle_mass_lb: e.muscleMass ? round2(e.muscleMass / GRAMS_PER_LB) : null,
      bone_mass_lb: e.boneMass ? round2(e.boneMass / GRAMS_PER_LB) : null,
      body_water_pct: e.bodyWater ? round1(e.bodyWater) : null,
    });
  }
  return rows;
}

export function buildStepsRows(days: RawStepsDay[]): StepsRow[] {
  return days
    .filter((d) => d.totalSteps != null)
    .map((d) => ({ local_date: d.calendarDate, steps: Math.round(d.totalSteps as number) }));
}

export function buildActivityRows(activities: RawActivity[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const a of activities) {
    if (!a.activityId || !a.startTimeGMT || !a.startTimeLocal) continue;
    rows.push({
      external_id: String(a.activityId),
      activity_type: a.activityType?.typeKey || "other",
      name: orNull(a.activityName),
      // Garmin sends both clocks as "YYYY-MM-DD HH:MM:SS". The local one's date is the
      // athlete's own day, so local_date is never derived from UTC.
      started_at: new Date(`${a.startTimeGMT.replace(" ", "T")}Z`).toISOString(),
      local_date: a.startTimeLocal.slice(0, 10),
      duration_s: a.duration ?? 0,
      moving_duration_s: orNull(a.movingDuration),
      distance_m: orNull(a.distance),
      elevation_gain_m: orNull(a.elevationGain),
      avg_speed_mps: orNull(a.averageSpeed),
      avg_grade_adjusted_speed_mps: orNull(a.avgGradeAdjustedSpeed),
      avg_hr: roundOrNull(a.averageHR),
      max_hr: roundOrNull(a.maxHR),
      avg_cadence_spm: orNull(a.averageRunningCadenceInStepsPerMinute),
      avg_stride_cm: orNull(a.avgStrideLength),
      avg_ground_contact_ms: orNull(a.avgGroundContactTime),
      calories: roundOrNull(a.calories),
      aerobic_training_effect: orNull(a.aerobicTrainingEffect),
      training_effect_label: orNull(a.trainingEffectLabel),
      training_load: orNull(a.activityTrainingLoad),
      vo2max: roundOrNull(a.vO2MaxValue),
      fastest_mile_s: orNull(a.fastestSplit_1609),
      hr_zone_s: hrZoneSeconds(a),
    });
  }
  return rows;
}

// ---------- Sleep and recovery (dashboard v2, Daily feel) ----------
// Field paths and units are documented in docs/garmin-fields.md.

/** One night from /sleep-service/sleep/dailySleepSummariesByDate. calendarDate is the
 * wake-up day; a day without a night comes back with every field null. */
export interface RawSleepNight {
  calendarDate?: string | null;
  sleepTimeSeconds?: number | null;
  deepSleepSeconds?: number | null;
  lightSleepSeconds?: number | null;
  remSleepSeconds?: number | null;
  awakeSleepSeconds?: number | null;
  sleepStartTimestampGMT?: number | null; // epoch ms
  sleepEndTimestampGMT?: number | null; // epoch ms
  sleepScores?: { overall?: { value?: number | null } | null } | null;
  sleepNeed?: { actual?: number | null } | null; // minutes
}

/** One night from /hrv-service/hrv/daily/{start}/{end} (`hrvSummaries[]`). */
export interface RawHrvDay {
  calendarDate?: string | null;
  lastNightAvg?: number | null;
  baseline?: { balancedLow?: number | null; balancedUpper?: number | null } | null;
  status?: string | null;
}

/** The recovery fields of /usersummary-service/usersummary/daily. */
export interface RawUserSummary {
  calendarDate?: string | null;
  restingHeartRate?: number | null;
  bodyBatteryHighestValue?: number | null;
  bodyBatteryLowestValue?: number | null;
  bodyBatteryAtWakeTime?: number | null;
  averageStressLevel?: number | null; // negative = not enough data
}

export interface SleepRow {
  local_date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_s: number;
  deep_s: number | null;
  rem_s: number | null;
  light_s: number | null;
  awake_s: number | null;
  score: number | null;
  need_s: number | null;
}

export const SLEEP_COLUMNS = [
  "bedtime", "wake_time", "duration_s", "deep_s", "rem_s", "light_s", "awake_s", "score", "need_s",
] as const satisfies readonly (keyof SleepRow)[];

/** The daily_recovery columns the Personal API import owns (the readiness columns belong to
 * the unofficial import and are never touched here). */
export interface RecoveryRow {
  local_date: string;
  resting_hr: number | null;
  hrv_ms: number | null;
  hrv_baseline_low: number | null;
  hrv_baseline_high: number | null;
  hrv_status: string | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  body_battery_wake: number | null;
  avg_stress: number | null;
}

export const RECOVERY_COLUMNS = [
  "resting_hr", "hrv_ms", "hrv_baseline_low", "hrv_baseline_high", "hrv_status",
  "body_battery_high", "body_battery_low", "body_battery_wake", "avg_stress",
] as const satisfies readonly (keyof RecoveryRow)[];

const intOrNull = (value: number | null | undefined) => (value == null ? null : Math.round(value));
/** Garmin reports "not enough data" as 0 or a negative sentinel for HR, stress and battery. */
const positiveIntOrNull = (value: number | null | undefined) => (value == null || value <= 0 ? null : Math.round(value));
const isoOrNull = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());

export function buildSleepRows(nights: RawSleepNight[]): SleepRow[] {
  const rows: SleepRow[] = [];
  for (const n of nights) {
    if (!n.calendarDate || !n.sleepTimeSeconds) continue;
    const needMin = n.sleepNeed?.actual;
    rows.push({
      local_date: n.calendarDate,
      bedtime: isoOrNull(n.sleepStartTimestampGMT),
      wake_time: isoOrNull(n.sleepEndTimestampGMT),
      duration_s: Math.round(n.sleepTimeSeconds),
      deep_s: intOrNull(n.deepSleepSeconds),
      rem_s: intOrNull(n.remSleepSeconds),
      light_s: intOrNull(n.lightSleepSeconds),
      awake_s: intOrNull(n.awakeSleepSeconds),
      score: intOrNull(n.sleepScores?.overall?.value),
      need_s: needMin == null ? null : Math.round(needMin * 60),
    });
  }
  return rows;
}

/**
 * HRV nights and daily summaries merged by day. A day appears when either source has a value
 * for it; the other source's columns are then null.
 */
export function buildRecoveryRows(hrv: RawHrvDay[], summaries: RawUserSummary[]): RecoveryRow[] {
  const byDate = new Map<string, RecoveryRow>();
  const rowFor = (date: string) => {
    let row = byDate.get(date);
    if (!row) {
      row = {
        local_date: date,
        resting_hr: null,
        hrv_ms: null,
        hrv_baseline_low: null,
        hrv_baseline_high: null,
        hrv_status: null,
        body_battery_high: null,
        body_battery_low: null,
        body_battery_wake: null,
        avg_stress: null,
      };
      byDate.set(date, row);
    }
    return row;
  };

  for (const h of hrv) {
    if (!h.calendarDate || h.lastNightAvg == null) continue;
    const row = rowFor(h.calendarDate);
    row.hrv_ms = h.lastNightAvg;
    row.hrv_baseline_low = h.baseline?.balancedLow ?? null;
    row.hrv_baseline_high = h.baseline?.balancedUpper ?? null;
    row.hrv_status = h.status ?? null;
  }

  for (const s of summaries) {
    if (!s.calendarDate) continue;
    const values = {
      resting_hr: positiveIntOrNull(s.restingHeartRate),
      body_battery_high: positiveIntOrNull(s.bodyBatteryHighestValue),
      body_battery_low: intOrNull(s.bodyBatteryLowestValue != null && s.bodyBatteryLowestValue < 0 ? null : s.bodyBatteryLowestValue),
      body_battery_wake: positiveIntOrNull(s.bodyBatteryAtWakeTime),
      avg_stress: positiveIntOrNull(s.averageStressLevel),
    };
    if (Object.values(values).every((v) => v == null)) continue;
    Object.assign(rowFor(s.calendarDate), values);
  }

  return [...byDate.values()].sort((a, b) => a.local_date.localeCompare(b.local_date));
}

/** [z1..z5] seconds, rounded; null when Garmin recorded no time in any zone. */
function hrZoneSeconds(a: RawActivity): number[] | null {
  const zones = [a.hrTimeInZone_1, a.hrTimeInZone_2, a.hrTimeInZone_3, a.hrTimeInZone_4, a.hrTimeInZone_5].map((s) =>
    Math.round(s ?? 0),
  );
  return zones.some((s) => s > 0) ? zones : null;
}

/**
 * The athlete's five zones as [low, high] bpm, from the "DEFAULT" sport (what running uses):
 * zone N runs from its floor to one below the next floor, zone 5 up to max HR.
 */
export function buildZoneBounds(sports: RawHrZones[]): [number, number][] | null {
  const z = sports.find((s) => s.sport === "DEFAULT") ?? sports[0];
  if (!z) return null;
  const floors = [z.zone1Floor, z.zone2Floor, z.zone3Floor, z.zone4Floor, z.zone5Floor];
  if (floors.some((f) => f == null) || z.maxHeartRateUsed == null) return null;
  const f = floors as number[];
  return f.map((low, i) => [low, i < 4 ? f[i + 1] - 1 : (z.maxHeartRateUsed as number)]);
}
