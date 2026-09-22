import type { DayWindow, LocalDate } from "@/lib/dates/calendar";

export type CellDateState = "pre_program" | "future" | "in_program";

/** Where a calendar day sits relative to the program, independent of whether it has data. */
export function cellDateState(
  date: LocalDate,
  programStart: LocalDate,
  today: LocalDate,
): CellDateState {
  if (date < programStart) return "pre_program";
  if (date > today) return "future";
  return "in_program";
}

/** Whether a day falls inside the currently selected range, for the heatmap's dimming. */
export function isInRange(date: LocalDate, range: DayWindow): boolean {
  return date >= range.from && date <= range.to;
}
