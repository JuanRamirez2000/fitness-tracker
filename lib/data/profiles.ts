import { z } from "zod";
import { WEIGHT_MAX_LB, WEIGHT_MIN_LB } from "./weigh-ins";

/** Mirrors the profiles table in db/schema.sql. */
export const profileSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  timezone: z.string(),
  program_start_date: z.string().nullable(),
  goal_weight_lb: z.number().nullable(),
  goal_pace_lb_per_week: z.number().nullable(),
  start_weight_lb: z.number().nullable(),
  /** 0 = Sunday ... 6 = Saturday: the weekday shots are scheduled on. */
  shot_weekday: z.number().int().min(0).max(6),
});

export type Profile = z.infer<typeof profileSchema>;

/** The settings form's editable subset — never id. */
export const profileSettingsSchema = profileSchema
  .pick({
    display_name: true,
    timezone: true,
    program_start_date: true,
    goal_weight_lb: true,
    goal_pace_lb_per_week: true,
    start_weight_lb: true,
    shot_weekday: true,
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
    program_start_date: z.iso.date().nullable().optional().transform((v) => v ?? null),
    // profiles has no CHECK constraint on these, so bounds live here: a typo like an extra
    // zero would otherwise save without complaint.
    goal_weight_lb: z.number().min(WEIGHT_MIN_LB).max(WEIGHT_MAX_LB).nullable(),
    start_weight_lb: z.number().min(WEIGHT_MIN_LB).max(WEIGHT_MAX_LB).nullable(),
    goal_pace_lb_per_week: z.number().positive().max(10).nullable(),
  });

export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
