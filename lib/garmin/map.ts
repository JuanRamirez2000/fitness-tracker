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
}

export interface WeighInRow {
  measured_at: string;
  local_date: string;
  weight_lb: number;
  external_id: string;
}

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
}

/** Every activities column the importer writes, besides user_id, source and external_id. */
export const ACTIVITY_COLUMNS = [
  "activity_type", "name", "started_at", "local_date", "duration_s", "moving_duration_s", "distance_m",
  "elevation_gain_m", "avg_speed_mps", "avg_grade_adjusted_speed_mps", "avg_hr", "max_hr", "avg_cadence_spm",
  "avg_stride_cm", "avg_ground_contact_ms", "calories", "aerobic_training_effect", "training_effect_label",
  "training_load", "vo2max", "fastest_mile_s",
] as const satisfies readonly (keyof ActivityRow)[];

const roundOrNull = (value: number | null | undefined) => (value ? Math.round(value) : null);
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
    });
  }
  return rows;
}
