import { z } from "zod";
import { localDateSchema, type LocalDate } from "@/lib/dates/calendar";
import { timestampSchema, uuidSchema } from "./common";

/**
 * The daily mood log (db/schema.sql mood_logs): four 1-5 ratings, where it's sore, and two
 * toggles. Every answer is optional, so "sick today" alone is a valid log. Pure schemas, safe
 * to import from client components.
 */

/** The four 1-5 questions, in the modal's order. 5 is always the good end, except soreness. */
export const MOOD_SCALES = ["mood", "energy", "soreness", "motivation"] as const;
export type MoodScale = (typeof MOOD_SCALES)[number];

export const MOOD_SCALE_LABELS: Record<MoodScale, string> = {
  mood: "Mood",
  energy: "Energy",
  soreness: "Soreness",
  motivation: "Motivation",
};

/** The words under each tap, 1 to 5. */
export const MOOD_SCALE_WORDS: Record<MoodScale, readonly [string, string, string, string, string]> = {
  mood: ["Awful", "Low", "OK", "Good", "Great"],
  energy: ["Drained", "Tired", "OK", "Fresh", "Charged"],
  soreness: ["None", "Light", "Some", "Sore", "Very sore"],
  motivation: ["None", "Low", "OK", "Keen", "Fired up"],
};

/** Body areas offered once soreness is SORE_AREAS_FROM or more. */
export const SORE_AREAS = ["legs", "hips", "back", "shoulders", "arms"] as const;
export type SoreArea = (typeof SORE_AREAS)[number];
export const SORE_AREAS_FROM = 3;

const rating = z.number().int().min(1).max(5).nullable();

/** What the modal sends (and the server action re-validates). */
export const moodLogInputSchema = z
  .object({
    local_date: localDateSchema,
    mood: rating,
    energy: rating,
    soreness: rating,
    sore_areas: z.array(z.enum(SORE_AREAS)).max(SORE_AREAS.length),
    motivation: rating,
    sick: z.boolean(),
    injured: z.boolean(),
  })
  .transform((v) => ({
    ...v,
    // Areas only mean something when soreness says it's sore.
    sore_areas: v.soreness !== null && v.soreness >= SORE_AREAS_FROM ? [...new Set(v.sore_areas)] : [],
  }));

export type MoodLogInput = z.infer<typeof moodLogInputSchema>;

export const moodLogRowSchema = z.object({
  user_id: uuidSchema,
  local_date: localDateSchema,
  mood: rating,
  energy: rating,
  soreness: rating,
  sore_areas: z.array(z.string()).transform((xs) => xs.filter((x): x is SoreArea => (SORE_AREAS as readonly string[]).includes(x))),
  motivation: rating,
  sick: z.boolean(),
  injured: z.boolean(),
  updated_at: timestampSchema,
});

export type MoodLog = z.infer<typeof moodLogRowSchema>;

/** A log with nothing in it: every rating empty and both toggles off. */
export function isEmptyLog(log: Pick<MoodLog, MoodScale | "sick" | "injured">): boolean {
  return MOOD_SCALES.every((k) => log[k] === null) && !log.sick && !log.injured;
}

/** Days marked sick or injured, for the chart markers. */
export interface OffDay {
  date: LocalDate;
  sick: boolean;
  injured: boolean;
}

export function offDays(logs: readonly MoodLog[]): OffDay[] {
  return logs.flatMap((l) => (l.sick || l.injured ? [{ date: l.local_date, sick: l.sick, injured: l.injured }] : []));
}
