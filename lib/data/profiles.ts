import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dashboardLayoutSchema, type DashboardLayout } from "@/lib/dashboard/widget-layout";
import { STEPS_MAX } from "./daily-metrics";
import { WEIGHT_MAX_LB, WEIGHT_MIN_LB } from "./weigh-ins";

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
  /** The bento KPI grid's arrangement (lib/dashboard/widget-layout.ts), shared by owner and
   * coach since they act on this one row. null = never customized. */
  dashboard_layout: dashboardLayoutSchema,
});

export type Profile = z.infer<typeof profileSchema>;

export async function fetchProfile(supabase: SupabaseClient, id: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error) throw error;
  return profileSchema.parse(data);
}

/** Separate from updateProfile/profileSettingsSchema below — this isn't a Settings-dialog
 * field, it's written directly from drag/resize/hide gestures on the bento grid itself. */
export async function updateDashboardLayout(supabase: SupabaseClient, id: string, layout: DashboardLayout): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").update({ dashboard_layout: layout }).eq("id", id).select().single();
  if (error) throw error;
  return profileSchema.parse(data);
}

/** The settings dialog's editable subset — never id/role, and never delete/insert: profiles
 * cascade-deletes tracking data, and the coach has this same update access as the owner (see
 * the RLS policies in supabase/schema.sql). calorie_target_kcal is left out until the kcal
 * field itself arrives in V1. */
export const profileSettingsSchema = profileSchema
  .pick({
    display_name: true,
    timezone: true,
    goal_weight_lb: true,
    goal_pace_lb_per_week: true,
    start_weight_lb: true,
    shot_weekday: true,
    steps_goal: true,
  })
  .extend({
    display_name: z.string().trim().min(1).max(80),
    timezone: z
      .string()
      .trim()
      .min(1)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Not a valid timezone, e.g. America/Los_Angeles"),
    // A native <select>'s value is always a string; FieldInput's "select" case (shared with
    // every table tab) never coerces it, so this field coerces instead of the other way
    // around — every other FieldSpec-driven select in the app is a real string enum.
    shot_weekday: z.coerce.number().int().min(0).max(6),
    // profiles has no CHECK constraint on any of these three (unlike weigh_ins.weight_lb or
    // daily_metrics' steps), so nothing stops a typo like an extra zero from being saved —
    // caught by hand while testing this dialog (goal_weight_lb was 1,000,010,000 for a
    // moment). Bounds mirror the values the rest of the app already treats as realistic.
    goal_weight_lb: z.number().min(WEIGHT_MIN_LB).max(WEIGHT_MAX_LB).nullable(),
    start_weight_lb: z.number().min(WEIGHT_MIN_LB).max(WEIGHT_MAX_LB).nullable(),
    goal_pace_lb_per_week: z.number().positive().max(10).nullable(),
    steps_goal: z.number().int().positive().max(STEPS_MAX),
  });

export type ProfileSettings = z.infer<typeof profileSettingsSchema>;

export async function updateProfile(supabase: SupabaseClient, id: string, values: ProfileSettings): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").update(values).eq("id", id).select().single();
  if (error) throw error;
  return profileSchema.parse(data);
}
