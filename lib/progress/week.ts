import { addDays, eachDay, isLocalDate, mondayOf, type LocalDate } from "@/lib/dates/calendar";

/**
 * The Progress tab's week: Monday to Sunday, picked with `?week=` (any day; it snaps to that
 * week's Monday). Defaults to the current week and never goes past it, nor before the program
 * began. Pure.
 */

export interface ProgressWeek {
  monday: LocalDate;
  sunday: LocalDate;
  /** Monday to Sunday. */
  days: LocalDate[];
  /** The week holds today. */
  current: boolean;
  /** The last day with data so far: Sunday, or today in the current week. */
  through: LocalDate;
}

/** `?week=` -> the Monday to show: the current week when missing or malformed, clamped to the
 * weeks from the program's start through this one. */
export function parseWeekParam(value: string | undefined, today: LocalDate, programStart: LocalDate): LocalDate {
  const current = mondayOf(today);
  if (!value || !isLocalDate(value)) return current;
  const monday = mondayOf(value);
  if (monday > current) return current;
  const first = mondayOf(programStart);
  return monday < first ? first : monday;
}

export function progressWeek(monday: LocalDate, today: LocalDate): ProgressWeek {
  const sunday = addDays(monday, 6);
  const current = today >= monday && today <= sunday;
  return { monday, sunday, days: eachDay(monday, sunday), current, through: current ? today : sunday };
}
