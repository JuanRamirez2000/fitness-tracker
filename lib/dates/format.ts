import { weekdayOf, type LocalDate } from "@/lib/dates/calendar";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-09-18" -> "Sep 18", for tooltip headers and delta text. Year-agnostic on purpose:
 * every tooltip is anchored to a specific cell, so the year is already implied. */
export function fmtDate(date: LocalDate): string {
  const [, month, day] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

/** "2026-09-18" -> "Friday". Used where a date's day-of-week reads better than the date
 * itself — the day editor sheet's subtitle for any day that isn't today. */
export function weekdayName(date: LocalDate): string {
  return WEEKDAYS[weekdayOf(date)];
}
