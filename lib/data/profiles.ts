import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const ROLES = ["owner", "coach"] as const;

/** Mirrors public.profiles in schema.sql. */
export const profileSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  role: z.enum(ROLES),
  timezone: z.string(),
  program_start_date: z.string().nullable(),
  goal_weight_lb: z.number().nullable(),
  goal_pace_lb_per_week: z.number().nullable(),
  start_weight_lb: z.number().nullable(),
  shot_weekday: z.number().int().min(0).max(6),
  steps_goal: z.number().int(),
  calorie_target_kcal: z.number().int().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

export async function fetchProfile(supabase: SupabaseClient, id: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error) throw error;
  return profileSchema.parse(data);
}
