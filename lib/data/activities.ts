import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";

/** One Garmin activity (lib/garmin/import.ts). Every type is stored; see isRun. */
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
});

export type Activity = z.infer<typeof activityRowSchema>;

/** Garmin's typeKeys for running: outdoor, treadmill, trail, track, and so on. */
export function isRun(activity: Pick<Activity, "activity_type">): boolean {
  return activity.activity_type.endsWith("running");
}
