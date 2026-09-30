import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { uuidSchema } from "./common";

/** n7 below this means the 7-day average is still warming up. */
export const MIN_AVG7_SAMPLES = 3;

/**
 * One row per recorded day (the earliest weigh-in counts) with the 7-day average and the
 * change against the previous RECORDED day. The first ever row has null deltas.
 */
export const weightTrendRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  weight_lb: z.number(),
  avg7_lb: z.number(),
  n7: z.number().int(),
  raw_delta_lb: z.number().nullable(),
  avg7_delta_lb: z.number().nullable(),
});

export type WeightTrendRow = z.infer<typeof weightTrendRowSchema>;

export const dailyWeightRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  weight_lb: z.number(),
});

export type DailyWeight = z.infer<typeof dailyWeightRowSchema>;

/** The earliest recorded day, which is the start weight unless the profile overrides it. */
export function firstDailyWeight(trend: WeightTrendRow[]): DailyWeight | null {
  const first = trend[0];
  return first ? { user_id: first.user_id, local_date: first.local_date, weight_lb: first.weight_lb } : null;
}
