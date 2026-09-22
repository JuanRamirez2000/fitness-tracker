import type { LocalDate } from "@/lib/dates/calendar";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-18" -> "Sep 18", for tooltip headers and delta text. Year-agnostic on purpose:
 * every tooltip is anchored to a specific cell, so the year is already implied. */
export function fmtDate(date: LocalDate): string {
  const [, month, day] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}
