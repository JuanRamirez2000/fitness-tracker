import { addDays, startOfWeek, type DayWindow, type LocalDate } from "@/lib/dates/calendar";

export const HEATMAP_WEEKS = 53;

/**
 * The heatmap's full window: 53 Sunday-to-Saturday columns anchored to the week containing the
 * program start. Once today passes the end of that first year it becomes the trailing 53
 * weeks, ending with the week that contains today.
 */
export function heatmapWindow(programStart: LocalDate, today: LocalDate): DayWindow {
  const anchor = startOfWeek(programStart);
  const firstYearEnd = addDays(anchor, HEATMAP_WEEKS * 7 - 1);
  if (today <= firstYearEnd) return { from: anchor, to: firstYearEnd };

  const lastWeek = startOfWeek(today);
  return { from: addDays(lastWeek, -(HEATMAP_WEEKS - 1) * 7), to: addDays(lastWeek, 6) };
}
