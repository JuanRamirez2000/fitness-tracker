import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";

/** The daily step target: the steps chart's goal line, and the bar color threshold. */
export const STEPS_GOAL = 10_000;

/** One day's step count. */
export const dailyStepsRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  steps: z.number().int(),
  source: sourceSchema,
  updated_at: timestampSchema,
});

export type DailySteps = z.infer<typeof dailyStepsRowSchema>;
