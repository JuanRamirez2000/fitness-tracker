import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const activityTypeSchema = z.object({
  key: z.string(),
  label: z.string(),
  // Drives the heatmap and legend, and feeds color math, so it must be #rrggbb.
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  sort_order: z.number().int(),
});

export type ActivityType = z.infer<typeof activityTypeSchema>;

export async function fetchActivityTypes(supabase: SupabaseClient): Promise<ActivityType[]> {
  const { data, error } = await supabase.from("activity_types").select("*").order("sort_order");
  if (error) throw error;
  return z.array(activityTypeSchema).parse(data);
}
