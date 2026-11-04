import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { sourceSchema, timestampSchema, uuidSchema } from "./common";

// Mirror the CHECK on weigh_ins.weight_lb.
export const WEIGHT_MIN_LB = 50;
export const WEIGHT_MAX_LB = 800;

/** The fields a person edits in the table. */
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
  // Index scale body composition (null for manual entries, and before migration 006).
  body_fat_pct: z.number().nullable().default(null),
  muscle_mass_lb: z.number().nullable().default(null),
  bone_mass_lb: z.number().nullable().default(null),
  body_water_pct: z.number().nullable().default(null),
  created_at: timestampSchema,
});

/** One day's body composition: the day's earliest weigh-in that carries one. */
export const bodyCompositionDaySchema = z.object({
  local_date: localDateSchema,
  weight_lb: z.number(),
  body_fat_pct: z.number(),
  muscle_mass_lb: z.number().nullable(),
  bone_mass_lb: z.number().nullable(),
  body_water_pct: z.number().nullable(),
});

export type BodyCompositionDay = z.infer<typeof bodyCompositionDaySchema>;

export type WeighInInput = z.infer<typeof weighInSchema>;
export type WeighIn = z.infer<typeof weighInRowSchema>;
