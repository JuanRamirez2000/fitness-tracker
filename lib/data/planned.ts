import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";

export const PUSH_STATUSES = ["draft", "queued", "sent", "failed", "removing"] as const;
export type PushStatus = (typeof PUSH_STATUSES)[number];

/** One planned session (db/schema.sql planned_workouts): from a Garmin Coach plan or the Garmin
 * calendar (scripts/garmin/import_unofficial.py's "plan" dataset, source 'garmin'), or one of
 * the tracker's own workouts (lib/workouts/, source 'self', sent by push_workout.py). */
export const plannedWorkoutRowSchema = z.object({
  workout_uuid: z.string(),
  local_date: localDateSchema,
  sport: z.string().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  duration_s: z.number().int().nullable(),
  benefit: z.string().nullable(),
  rest_day: z.boolean(),
  key_workout: z.boolean(),
  status: z.string().nullable(),
  plan_name: z.string().nullable(),
  // Migration 016. Defaults keep rows read before it parseable.
  source: z.enum(["garmin", "self"]).default("garmin"),
  settings: z.record(z.string(), z.unknown()).nullable().default(null),
  steps: z.array(z.unknown()).nullable().default(null),
  push_status: z.enum(PUSH_STATUSES).nullable().default(null),
  push_error: z.string().nullable().default(null),
  pushed_at: z.string().nullable().default(null),
});

export type PlannedWorkout = z.infer<typeof plannedWorkoutRowSchema>;

/** One "Next up" session under the Training summary: Garmin's plan, explained, or the model's
 * own suggestion when nothing is planned. */
export const nextSessionSchema = z.object({
  date: localDateSchema,
  title: z.string(),
  details: z.string(),
  /** garmin: the Coach plan; self: one of the tracker's own workouts; suggested: the model's. */
  source: z.enum(["garmin", "self", "suggested"]),
});

export type NextSession = z.infer<typeof nextSessionSchema>;
