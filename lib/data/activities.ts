import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localDateSchema, type DayWindow } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";
import { fetchRows } from "./paginate";

/** The fields a person edits. Lifting is activity_type 'lift' with free-text notes. */
export const activitySchema = z.object({
  local_date: localDateSchema,
  activity_type: z.string().min(1),
  duration_min: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
});

export const activityRowSchema = activitySchema.extend({
  id: uuidSchema,
  user_id: uuidSchema,
  source: sourceSchema,
  external_id: z.string().nullable(),
  created_at: timestampSchema,
});

export type ActivityInput = z.infer<typeof activitySchema>;
export type Activity = z.infer<typeof activityRowSchema>;

/** A day can have several activities; the heatmap shows "multiple" for more than one. */
export function fetchActivities(
  supabase: SupabaseClient,
  userId: string,
  range?: DayWindow,
): Promise<Activity[]> {
  return fetchRows(activityRowSchema, (from, to) => {
    let query = supabase.from("activities").select("*").eq("user_id", userId);
    if (range) query = query.gte("local_date", range.from).lte("local_date", range.to);
    return query.order("local_date").order("created_at").range(from, to);
  });
}
