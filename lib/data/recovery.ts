import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { timestampSchema, uuidSchema } from "./common";

/** The six readiness factors, in the hero's display order, with Garmin's percentages. */
export const READINESS_FACTOR_KEYS = ["sleep_history", "hrv", "recovery_time", "acwr", "stress_history", "sleep"] as const;
export type ReadinessFactorKey = (typeof READINESS_FACTOR_KEYS)[number];

export const readinessFactorsSchema = z.object(
  Object.fromEntries(READINESS_FACTOR_KEYS.map((k) => [k, z.number().nullable().optional()])) as Record<
    ReadinessFactorKey,
    z.ZodOptional<z.ZodNullable<z.ZodNumber>>
  >,
);

/** One day of watch-derived recovery (db/schema.sql daily_recovery). The HRV, resting HR,
 * Body Battery and stress columns come from the Personal API; the readiness columns from the
 * unofficial import. Any of them can be null on a given day. */
export const dailyRecoveryRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  resting_hr: z.number().int().nullable(),
  hrv_ms: z.number().nullable(),
  hrv_baseline_low: z.number().nullable(),
  hrv_baseline_high: z.number().nullable(),
  hrv_status: z.string().nullable(),
  body_battery_high: z.number().int().nullable(),
  body_battery_low: z.number().int().nullable(),
  body_battery_wake: z.number().int().nullable(),
  avg_stress: z.number().int().nullable(),
  readiness_score: z.number().int().nullable(),
  readiness_level: z.string().nullable(),
  readiness_factors: readinessFactorsSchema.nullable(),
  readiness_at: timestampSchema.nullable(),
  readiness_morning_score: z.number().int().nullable(),
  recovery_hours: z.number().nullable(),
});

export type DailyRecovery = z.infer<typeof dailyRecoveryRowSchema>;

/** One night of sleep, keyed by the wake-up day (db/schema.sql sleep_nights). */
export const sleepNightRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  bedtime: timestampSchema.nullable(),
  wake_time: timestampSchema.nullable(),
  duration_s: z.number().int().nullable(),
  deep_s: z.number().int().nullable(),
  rem_s: z.number().int().nullable(),
  light_s: z.number().int().nullable(),
  awake_s: z.number().int().nullable(),
  score: z.number().int().nullable(),
  need_s: z.number().int().nullable(),
});

export type SleepNight = z.infer<typeof sleepNightRowSchema>;
