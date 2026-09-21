import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localDateSchema, type DayWindow } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";
import { fetchRows } from "./paginate";

export const STEPS_METRIC = "steps";

// The database has no upper bound; this only catches a typo such as an extra zero.
export const STEPS_MAX = 200_000;

/** The fields a person edits on the Steps tab (metric is fixed to 'steps'). */
export const stepsSchema = z.object({
  local_date: localDateSchema,
  value: z.number().int().min(0).max(STEPS_MAX),
});

export const dailyMetricRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  metric: z.string(),
  value: z.number(),
  source: sourceSchema,
  updated_at: timestampSchema,
});

export type StepsInput = z.infer<typeof stepsSchema>;
export type DailyMetric = z.infer<typeof dailyMetricRowSchema>;

/** Steps live in daily_metrics so sleep and protein can join them without a migration. */
export function fetchSteps(
  supabase: SupabaseClient,
  userId: string,
  range?: DayWindow,
): Promise<DailyMetric[]> {
  return fetchRows(dailyMetricRowSchema, (from, to) => {
    let query = supabase
      .from("daily_metrics")
      .select("*")
      .eq("user_id", userId)
      .eq("metric", STEPS_METRIC);
    if (range) query = query.gte("local_date", range.from).lte("local_date", range.to);
    return query.order("local_date").range(from, to);
  });
}
