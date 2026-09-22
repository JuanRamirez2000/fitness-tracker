import type { LocalDate } from "@/lib/dates/calendar";

/**
 * react-day-picker works with plain JS Date objects at local midnight, not LocalDate
 * strings. These treat a LocalDate's own Y-M-D digits as the browser's local calendar date,
 * sidestepping real timezone conversion entirely (there is nothing to convert: both sides
 * are already "a day", not an instant, and the picker never needs to agree with the
 * athlete's configured timezone on what a day is — it just needs to round-trip the digits).
 */
export function localDateToJsDate(date: LocalDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function jsDateToLocalDate(date: Date): LocalDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
