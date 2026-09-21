import {
  addDays,
  addMonths,
  assertLocalDate,
  type DayWindow,
  type LocalDate,
} from "@/lib/dates/calendar";
import type { DateRange, RangeKey } from "@/lib/dashboard/types";

// The design is silent on what "week" and "month" mean, so these are named for easy change.
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;
export const SIX_MONTHS = 6;
export const YEAR_MONTHS = 12;

/**
 * Turns a range key into concrete inclusive local dates. `today` is the athlete's local day
 * (see todayIn), never a UTC date. Pure: the caller supplies every input.
 */
export function resolveRange(
  key: RangeKey,
  today: LocalDate,
  programStart: LocalDate,
  custom?: DayWindow,
): DateRange {
  assertLocalDate(today);
  switch (key) {
    case "week":
      return { key, from: addDays(today, -(WEEK_DAYS - 1)), to: today };
    case "month":
      return { key, from: addDays(today, -(MONTH_DAYS - 1)), to: today };
    case "6m":
      return { key, from: addMonths(today, -SIX_MONTHS), to: today };
    case "year":
      return { key, from: addMonths(today, -YEAR_MONTHS), to: today };
    case "all":
      // A program that starts in the future still gets a valid one-day window.
      assertLocalDate(programStart);
      return { key, from: programStart < today ? programStart : today, to: today };
    case "custom": {
      if (!custom) throw new Error("resolveRange: a custom range needs from and to");
      assertLocalDate(custom.from);
      assertLocalDate(custom.to);
      // Nothing after today can have data, so clamp both ends, then put them in order.
      const [from, to] = [custom.from, custom.to].map((d) => (d < today ? d : today)).sort();
      return { key, from, to };
    }
  }
}
