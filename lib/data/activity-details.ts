import { z } from "zod";
import { timestampSchema, uuidSchema } from "./common";

const points = z.array(z.number().nullable());

/**
 * One activity's samples, columnar: index i of every array is the same moment. Thinned to a
 * few hundred points (lib/garmin/details.ts, thinSeries); a metric the watch didn't record
 * is left out rather than stored as all nulls.
 */
export const activitySeriesSchema = z.object({
  /** Seconds of timer time since the start (pauses excluded). */
  t: z.array(z.number()),
  /** Meters since the start. */
  d: points.optional(),
  hr: points.optional(),
  /** Meters per second. */
  speed: points.optional(),
  /** Grade-adjusted speed, meters per second. */
  gap: points.optional(),
  /** Steps per minute, both feet (runs) or revolutions per minute (rides). */
  cadence: points.optional(),
  /** Meters above sea level. */
  elev: points.optional(),
  power: points.optional(),
  /** Centimeters. */
  stride: points.optional(),
  /** Ground contact time, milliseconds. */
  gct: points.optional(),
  /** Vertical oscillation, centimeters. */
  vo: points.optional(),
  /** Body Battery, 0-100. */
  bb: points.optional(),
  /** Available stamina, percent. */
  stamina: points.optional(),
  /** Garmin's performance condition, about -20 to +20. */
  perf: points.optional(),
  /** Air temperature at the watch, °C. */
  temp: points.optional(),
  lat: points.optional(),
  lon: points.optional(),
});
export type ActivitySeries = z.infer<typeof activitySeriesSchema>;
export type SeriesKey = Exclude<keyof ActivitySeries, "t">;

/** One mile (the last one may be partial), from the full-resolution samples. */
export const mileSplitSchema = z.object({
  /** 1-based. */
  mile: z.number().int(),
  distance_m: z.number(),
  duration_s: z.number(),
  avg_hr: z.number().nullable(),
  avg_cadence_spm: z.number().nullable(),
  /** Mean grade-adjusted speed, meters per second. */
  avg_gap_mps: z.number().nullable(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number(),
});
export type MileSplit = z.infer<typeof mileSplitSchema>;

/** Garmin's split summary for one split type, totalled over every split of that type. */
export const intervalSplitSchema = z.object({
  /** Garmin's splitType: RWD_RUN, RWD_WALK, RWD_STAND, INTERVAL_WARMUP, INTERVAL_ACTIVE... */
  type: z.string(),
  count: z.number().int(),
  distance_m: z.number().nullable(),
  duration_s: z.number().nullable(),
  avg_speed_mps: z.number().nullable(),
  avg_hr: z.number().nullable(),
  max_hr: z.number().nullable(),
  avg_cadence_spm: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
});
export type IntervalSplit = z.infer<typeof intervalSplitSchema>;

/** One run's best efforts (migration 012): fastest times over set distances, and its longest continuous running. */
export const activityEffortsSchema = z.object({
  /** Seconds, or null when the run was shorter than the distance. */
  fastest: z.object({ mile: z.number().nullable(), two_mile: z.number().nullable(), five_k: z.number().nullable() }),
  longest_running: z.object({ seconds: z.number(), meters: z.number().nullable() }).nullable(),
});
export type ActivityEfforts = z.infer<typeof activityEffortsSchema>;

/** A run's efforts with what's needed to name and open it (the Training tab's best efforts card). */
export interface RunEfforts {
  activity_id: string;
  local_date: string;
  name: string | null;
  efforts: ActivityEfforts;
}

/** One activity_details row (migration 010). */
export const activityDetailRowSchema = z.object({
  activity_id: uuidSchema,
  user_id: uuidSchema,
  location_name: z.string().nullable(),
  workout_feel: z.number().int().nullable(),
  workout_rpe: z.number().int().nullable(),
  min_hr: z.number().int().nullable(),
  stamina_start: z.number().int().nullable(),
  stamina_end: z.number().int().nullable(),
  series: activitySeriesSchema.nullable(),
  mile_splits: z.array(mileSplitSchema).nullable(),
  interval_splits: z.array(intervalSplitSchema).nullable(),
  efforts: activityEffortsSchema.nullable().default(null),
  fetched_at: timestampSchema,
});
export type ActivityDetail = z.infer<typeof activityDetailRowSchema>;
