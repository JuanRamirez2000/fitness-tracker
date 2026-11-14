import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";

/**
 * The athlete's workout settings (profiles.workout_settings, migration 016): what the builder
 * needs that Garmin doesn't hold, or holds wrong. Every field has a default, so an empty
 * object is valid and the column can stay null until something is changed.
 */

/** Where swimming stands, set by hand until swims arrive from Garmin. */
export const SWIM_STAGES = [
  { stage: 0, label: "Can't swim a length yet" },
  { stage: 1, label: "1–2 lengths at a time" },
  { stage: 2, label: "100 yd (4 lengths) at a time" },
  { stage: 3, label: "200+ yd at a time" },
  { stage: 4, label: "400 yd nonstop" },
] as const;
export type SwimStage = (typeof SWIM_STAGES)[number]["stage"];

export const workoutSettingsSchema = z.object({
  /** Cycling FTP the bike targets are built from. Null: estimated from the best 20 minutes. */
  ftp_w: z.number().int().min(50).max(500).nullable().default(null),
  swim_stage: z.number().int().min(0).max(4).default(0),
  pool: z
    .object({ length: z.number().positive().max(100), unit: z.enum(["yard", "meter"]) })
    .default({ length: 25, unit: "yard" }),
  /** The A race the phases count down to. */
  race: z
    .object({ name: z.string().max(80), date: localDateSchema })
    .nullable()
    .default({ name: "Cal Tri Lake Perris Sprint", date: "2027-04-11" }),
  /** 0 = Sunday ... 6 = Saturday. */
  swim_days: z.array(z.number().int().min(0).max(6)).default([0]),
  long_days: z.array(z.number().int().min(0).max(6)).default([0, 6]),
  /** Weekly training time the planner warns past, across every sport and the Coach plan. */
  weekly_hours_max: z.number().min(1).max(30).default(7),
});

export type WorkoutSettings = z.infer<typeof workoutSettingsSchema>;

export function parseWorkoutSettings(value: unknown): WorkoutSettings {
  const parsed = workoutSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : workoutSettingsSchema.parse({});
}

/** What the modal's settings row may change. */
export const workoutSettingsPatchSchema = workoutSettingsSchema.pick({ ftp_w: true, swim_stage: true }).partial();

/**
 * The FTP the ride targets use: the athlete's own setting, else 95% of the best 20 minutes in
 * the last 90 days (the classic 20-minute test estimate), else Garmin's. Garmin's own FTP is
 * last because it has been far above anything ridden (222 W against a 138 W best 20 minutes),
 * and ERG mode would hold those watts.
 */
export function effectiveFtp(settings: WorkoutSettings, best20MinW: number | null, garminFtpW: number | null): { watts: number | null; source: "setting" | "estimate" | "garmin" | "none" } {
  if (settings.ftp_w) return { watts: settings.ftp_w, source: "setting" };
  if (best20MinW && best20MinW > 0) return { watts: Math.round(best20MinW * 0.95), source: "estimate" };
  if (garminFtpW && garminFtpW > 0) return { watts: garminFtpW, source: "garmin" };
  return { watts: null, source: "none" };
}
