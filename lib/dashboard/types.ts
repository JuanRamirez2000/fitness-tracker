import type { DayWindow } from "@/lib/dates/calendar";

export const RANGE_KEYS = ["week", "month", "6m", "year", "all", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** The window that drives the charts and the table. Both ends are inclusive local dates. */
export interface DateRange extends DayWindow {
  key: RangeKey;
}
