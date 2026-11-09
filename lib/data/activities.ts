import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";

/** One Garmin activity (lib/garmin/import.ts). Every type is stored; see lib/sport.ts. */
export const activityRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  source: sourceSchema,
  external_id: z.string(),
  activity_type: z.string(),
  name: z.string().nullable(),
  started_at: timestampSchema,
  local_date: localDateSchema,
  duration_s: z.number(),
  moving_duration_s: z.number().nullable(),
  distance_m: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  avg_speed_mps: z.number().nullable(),
  avg_grade_adjusted_speed_mps: z.number().nullable(),
  avg_hr: z.number().int().nullable(),
  max_hr: z.number().int().nullable(),
  avg_cadence_spm: z.number().nullable(),
  avg_stride_cm: z.number().nullable(),
  avg_ground_contact_ms: z.number().nullable(),
  calories: z.number().int().nullable(),
  aerobic_training_effect: z.number().nullable(),
  training_effect_label: z.string().nullable(),
  training_load: z.number().nullable(),
  vo2max: z.number().int().nullable(),
  fastest_mile_s: z.number().nullable(),
  /** [z1..z5] seconds in each HR zone (null without HR, and before migration 007). */
  hr_zone_s: z.array(z.number()).length(5).nullable().default(null),
  // The rest of the activity list's fields (migration 010; null on rows imported before it).
  elevation_loss_m: z.number().nullable().default(null),
  max_speed_mps: z.number().nullable().default(null),
  anaerobic_training_effect: z.number().nullable().default(null),
  avg_power_w: z.number().int().nullable().default(null),
  max_power_w: z.number().int().nullable().default(null),
  norm_power_w: z.number().int().nullable().default(null),
  avg_vertical_oscillation_cm: z.number().nullable().default(null),
  avg_vertical_ratio: z.number().nullable().default(null),
  min_temp_c: z.number().nullable().default(null),
  max_temp_c: z.number().nullable().default(null),
  body_battery_change: z.number().int().nullable().default(null),
  steps: z.number().int().nullable().default(null),
  // Rides (migration 014).
  avg_cadence_rpm: z.number().nullable().default(null),
  max_cadence_rpm: z.number().int().nullable().default(null),
  max_20min_power_w: z.number().int().nullable().default(null),
  /** Garmin's TSS and intensity factor, worked out against the FTP set in Garmin Connect. */
  training_stress_score: z.number().nullable().default(null),
  intensity_factor: z.number().nullable().default(null),
  /** [z1..z7] seconds in each power zone. */
  power_zone_s: z.array(z.number()).nullable().default(null),
  /** Best average power per duration: {"<seconds>": watts}, from Garmin's maxAvgPower_N. */
  power_curve: z.record(z.string(), z.number()).nullable().default(null),
});

export type Activity = z.infer<typeof activityRowSchema>;

export { isRide, isRun } from "../sport";

/** On-foot activities (runs, walks, hikes) get a mile-splits table; rides and swims don't. */
export function onFoot(activityType: string): boolean {
  return activityType.endsWith("running") || activityType.endsWith("walking") || activityType === "hiking";
}
