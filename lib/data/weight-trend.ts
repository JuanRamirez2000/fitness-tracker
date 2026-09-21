import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localDateSchema, type DayWindow } from "@/lib/dates/calendar";
import { uuidSchema } from "./common";
import { fetchRows } from "./paginate";

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

/**
 * The view's window functions run before this date filter, so deltas and averages stay
 * correct at the edges of a range: the first row in range still compares to the day before.
 */
export function fetchWeightTrend(
  supabase: SupabaseClient,
  userId: string,
  range?: DayWindow,
): Promise<WeightTrendRow[]> {
  return fetchRows(weightTrendRowSchema, (from, to) => {
    let query = supabase.from("weight_trend").select("*").eq("user_id", userId);
    if (range) query = query.gte("local_date", range.from).lte("local_date", range.to);
    return query.order("local_date").range(from, to);
  });
}

export const dailyWeightRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  weight_lb: z.number(),
});

export type DailyWeight = z.infer<typeof dailyWeightRowSchema>;

/** The earliest recorded day, which is the start weight unless the profile overrides it. */
export async function fetchFirstDailyWeight(
  supabase: SupabaseClient,
  userId: string,
): Promise<DailyWeight | null> {
  const { data, error } = await supabase
    .from("daily_weight")
    .select("user_id, local_date, weight_lb")
    .eq("user_id", userId)
    .order("local_date")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? dailyWeightRowSchema.parse(data) : null;
}
