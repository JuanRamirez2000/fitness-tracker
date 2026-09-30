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
  created_at: timestampSchema,
});

export type WeighInInput = z.infer<typeof weighInSchema>;
export type WeighIn = z.infer<typeof weighInRowSchema>;
