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

/** injections.id is the real primary key, but unique(user_id, local_date) means at most one
 * shot a day in practice — upsert on that pair so "add" and "edit" are the same call. */
export async function upsertInjection(
  supabase: SupabaseClient,
  userId: string,
  values: InjectionInput,
): Promise<Injection> {
  const { data, error } = await supabase
    .from("injections")
    .upsert({ user_id: userId, ...values }, { onConflict: "user_id,local_date" })
    .select()
    .single();
  if (error) throw error;
  return injectionRowSchema.parse(data);
}

export async function deleteInjection(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("injections").delete().eq("id", id);
  if (error) throw error;
}
