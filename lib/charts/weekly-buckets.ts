import { eachDay, startOfWeek, type DayWindow, type LocalDate } from "@/lib/dates/calendar";

/**
 * Every day in `window`, grouped into calendar weeks (Sunday-start, matching
 * lib/dates/calendar.ts's startOfWeek) and sorted oldest first. The first and last bucket can
 * be partial when the window doesn't start on a Sunday or end on a Saturday — every weekly
 * chart accepts that rather than padding with days outside the selected range.
 */
export function weeklyBuckets(window: DayWindow): LocalDate[][] {
  const buckets = new Map<LocalDate, LocalDate[]>();
  for (const date of eachDay(window.from, window.to)) {
    const weekStart = startOfWeek(date);
    const bucket = buckets.get(weekStart);
    if (bucket) bucket.push(date);
    else buckets.set(weekStart, [date]);
  }
  return [...buckets.keys()].sort().map((key) => buckets.get(key)!);
}
