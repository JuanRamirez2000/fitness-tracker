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

/** The table's real primary key is (user_id, local_date, metric), so one steps row a day. */
export async function upsertSteps(
  supabase: SupabaseClient,
  userId: string,
  values: StepsInput,
): Promise<DailyMetric> {
  const { data, error } = await supabase
    .from("daily_metrics")
    .upsert(
      { user_id: userId, local_date: values.local_date, metric: STEPS_METRIC, value: values.value, source: "manual" },
      { onConflict: "user_id,local_date,metric" },
    )
    .select()
    .single();
  if (error) throw error;
  return dailyMetricRowSchema.parse(data);
}

export async function deleteSteps(supabase: SupabaseClient, userId: string, localDate: string): Promise<void> {
  const { error } = await supabase
    .from("daily_metrics")
    .delete()
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .eq("metric", STEPS_METRIC);
  if (error) throw error;
}
