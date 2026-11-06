import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";

const focusPartSchema = z.object({ value: z.number().nullable(), low: z.number().nullable(), high: z.number().nullable() });

export const LOAD_FOCUS_KEYS = ["aerobic_low", "aerobic_high", "anaerobic"] as const;
export type LoadFocusKey = (typeof LOAD_FOCUS_KEYS)[number];

/** One day's training snapshot (db/schema.sql daily_training). Every value is Garmin's own;
 * any can be null on a day Garmin didn't update it. */
export const dailyTrainingRowSchema = z.object({
  local_date: localDateSchema,
  acute_load: z.number().nullable(),
  chronic_load: z.number().nullable(),
  chronic_low: z.number().nullable(),
  chronic_high: z.number().nullable(),
  acwr: z.number().nullable(),
  status: z.string().nullable(),
  focus: z.record(z.enum(LOAD_FOCUS_KEYS), focusPartSchema).nullable(),
  focus_feedback: z.string().nullable(),
  vo2max: z.number().nullable(),
  race_5k_s: z.number().int().nullable(),
  race_10k_s: z.number().int().nullable(),
  race_half_s: z.number().int().nullable(),
  /** Migration 013; null on rows imported before it. */
  race_marathon_s: z.number().int().nullable().default(null),
  fitness_age: z.number().nullable(),
  fitness_age_achievable: z.number().nullable(),
  chronological_age: z.number().int().nullable(),
  fitness_age_factors: z.record(z.string(), z.unknown()).nullable(),
});

export type DailyTraining = z.infer<typeof dailyTrainingRowSchema>;
