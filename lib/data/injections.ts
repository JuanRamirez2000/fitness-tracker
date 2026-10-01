import { z } from "zod";
import { localDateSchema } from "@/lib/dates/calendar";
import { timestampSchema, uuidSchema } from "./common";

/** One Zepbound shot, on the day it was actually taken. */
export const injectionRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  local_date: localDateSchema,
  dose_mg: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: timestampSchema,
});

export type Injection = z.infer<typeof injectionRowSchema>;
