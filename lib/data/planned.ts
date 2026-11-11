import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";

/** One planned session from a Garmin Coach plan or the Garmin calendar (db/schema.sql
 * planned_workouts, written by scripts/garmin/import_unofficial.py's "plan" dataset). */
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
});

export type PlannedWorkout = z.infer<typeof plannedWorkoutRowSchema>;

/** One "Next up" session under the Training summary: Garmin's plan, explained, or the model's
 * own suggestion when nothing is planned. */
export const nextSessionSchema = z.object({
  date: localDateSchema,
  title: z.string(),
  details: z.string(),
  source: z.enum(["garmin", "suggested"]),
});

export type NextSession = z.infer<typeof nextSessionSchema>;
