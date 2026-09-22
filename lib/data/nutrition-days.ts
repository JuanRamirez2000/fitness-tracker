import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localDateSchema, type DayWindow } from "@/lib/dates/calendar";
import { timestampSchema, uuidSchema } from "./common";
import { fetchRows } from "./paginate";

export const TRACKING_STATUSES = ["accurate", "uncertain", "missed"] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

/** The fields a person edits. calories_kcal has no UI until V1 but the column is live. */
export const nutritionDaySchema = z.object({
  local_date: localDateSchema,
  tracking_status: z.enum(TRACKING_STATUSES),
  calories_kcal: z.number().int().min(0).max(20000).nullable(),
  notes: z.string().nullable(),
});

export const nutritionDayRowSchema = nutritionDaySchema.extend({
  user_id: uuidSchema,
  updated_at: timestampSchema,
});

export type NutritionDayInput = z.infer<typeof nutritionDaySchema>;
export type NutritionDay = z.infer<typeof nutritionDayRowSchema>;

export function fetchNutritionDays(
  supabase: SupabaseClient,
  userId: string,
  range?: DayWindow,
): Promise<NutritionDay[]> {
  return fetchRows(nutritionDayRowSchema, (from, to) => {
    let query = supabase.from("nutrition_days").select("*").eq("user_id", userId);
    if (range) query = query.gte("local_date", range.from).lte("local_date", range.to);
    return query.order("local_date").range(from, to);
  });
}

/** The table's real primary key is (user_id, local_date), so there is only ever one row a
 * day to edit — add row and inline/dialog edit are the same upsert. */
export async function upsertNutritionDay(
  supabase: SupabaseClient,
  userId: string,
  values: NutritionDayInput,
): Promise<NutritionDay> {
  const { data, error } = await supabase
    .from("nutrition_days")
    .upsert({ user_id: userId, ...values }, { onConflict: "user_id,local_date" })
    .select()
    .single();
  if (error) throw error;
  return nutritionDayRowSchema.parse(data);
}

export async function deleteNutritionDay(supabase: SupabaseClient, userId: string, localDate: string): Promise<void> {
  const { error } = await supabase.from("nutrition_days").delete().eq("user_id", userId).eq("local_date", localDate);
  if (error) throw error;
}
