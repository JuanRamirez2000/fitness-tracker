import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localDateSchema, type DayWindow } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";
import { fetchRows } from "./paginate";

// Mirror the CHECK on weigh_ins.weight_lb.
export const WEIGHT_MIN_LB = 50;
export const WEIGHT_MAX_LB = 800;

/** The fields a person edits. Shared by inline edit, the add row and the form dialog. */
export const weighInSchema = z.object({
  local_date: localDateSchema,
  weight_lb: z.number().min(WEIGHT_MIN_LB).max(WEIGHT_MAX_LB),
});

export const weighInRowSchema = weighInSchema.extend({
  id: uuidSchema,
  user_id: uuidSchema,
  measured_at: timestampSchema,
  source: sourceSchema,
  external_id: z.string().nullable(),
  created_at: timestampSchema,
});

export type WeighInInput = z.infer<typeof weighInSchema>;
export type WeighIn = z.infer<typeof weighInRowSchema>;

/**
 * Every weigh-in, including several on one day (the table edits raw rows). For the one that
 * counts per day, see weight_trend.
 */
export function fetchWeighIns(
  supabase: SupabaseClient,
  userId: string,
  range?: DayWindow,
): Promise<WeighIn[]> {
  return fetchRows(weighInRowSchema, (from, to) => {
    let query = supabase.from("weigh_ins").select("*").eq("user_id", userId);
    if (range) query = query.gte("local_date", range.from).lte("local_date", range.to);
    return query.order("local_date").order("measured_at").range(from, to);
  });
}

/** `measuredAt` comes from defaultMeasuredAt() (lib/dates/timezone.ts) — the caller owns
 * timezone handling, this module stays timezone-agnostic like the rest of lib/data. */
export async function insertWeighIn(
  supabase: SupabaseClient,
  userId: string,
  values: WeighInInput,
  measuredAt: Date,
): Promise<WeighIn> {
  const { data, error } = await supabase
    .from("weigh_ins")
    .insert({ user_id: userId, ...values, measured_at: measuredAt.toISOString(), source: "manual" })
    .select()
    .single();
  if (error) throw error;
  return weighInRowSchema.parse(data);
}

export async function updateWeighIn(
  supabase: SupabaseClient,
  id: string,
  values: WeighInInput,
): Promise<WeighIn> {
  const { data, error } = await supabase.from("weigh_ins").update(values).eq("id", id).select().single();
  if (error) throw error;
  return weighInRowSchema.parse(data);
}

export async function deleteWeighIn(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("weigh_ins").delete().eq("id", id);
  if (error) throw error;
}
