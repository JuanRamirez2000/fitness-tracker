import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localDateSchema, type DayWindow } from "@/lib/dates/calendar";
import { timestampSchema, uuidSchema } from "./common";
import { fetchRows } from "./paginate";

/** The fields a person edits. One shot per day (unique on user_id, local_date). */
export const injectionSchema = z.object({
  local_date: localDateSchema,
  dose_mg: z.number().min(0).max(999.99).nullable(),
  notes: z.string().nullable(),
});

export const injectionRowSchema = injectionSchema.extend({
  id: uuidSchema,
  user_id: uuidSchema,
  created_at: timestampSchema,
});

export type InjectionInput = z.infer<typeof injectionSchema>;
export type Injection = z.infer<typeof injectionRowSchema>;

export function fetchInjections(
  supabase: SupabaseClient,
  userId: string,
  range?: DayWindow,
): Promise<Injection[]> {
  return fetchRows(injectionRowSchema, (from, to) => {
    let query = supabase.from("injections").select("*").eq("user_id", userId);
    if (range) query = query.gte("local_date", range.from).lte("local_date", range.to);
    return query.order("local_date").range(from, to);
  });
}
