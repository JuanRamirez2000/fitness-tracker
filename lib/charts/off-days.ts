import { offDays, type MoodLog, type OffDay } from "@/lib/data/mood";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";

/**
 * Sick and injured days from the mood log, for the faint columns drawn behind the recovery and
 * training charts (components/charts/parts.tsx OffDayBands), so a dip on those days reads as
 * "I was ill" rather than lost fitness. Pure.
 */
export interface OffDays {
  days: OffDay[];
  byDate: Map<LocalDate, OffDay>;
}

export function offDaysIn(logs: readonly MoodLog[], window: DayWindow): OffDays {
  const days = offDays(logs).filter((d) => isInRange(d.date, window));
  return { days, byDate: new Map(days.map((d) => [d.date, d])) };
}

/** "Sick", "Injured" or "Sick and injured". */
export function offDayLabel(day: Pick<OffDay, "sick" | "injured">): string {
  if (day.sick && day.injured) return "Sick and injured";
  return day.sick ? "Sick" : "Injured";
}

/** The tooltip row for a day, when it was an off day. */
export function offDayRows(off: OffDays, date: LocalDate): { label: string; value: string; swatch: { shape: "band"; className: string } }[] {
  const day = off.byDate.get(date);
  return day ? [{ label: "Logged", value: offDayLabel(day), swatch: { shape: "band", className: OFF_DAY_BG } }] : [];
}

/** The columns' color: neutral gray, so it never reads as a good/bad zone on the chart. */
export const OFF_DAY_FILL = "fill-muted-2/20";
export const OFF_DAY_BG = "bg-muted-2/30";
