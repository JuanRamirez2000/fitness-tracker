import { addDays, type DayWindow } from "@/lib/dates/calendar";
import { HEATMAP_WEEKS } from "./window";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface MonthLabel {
  /** 0-based column (week) index into the 53-column grid. */
  column: number;
  label: string;
}

/**
 * One label per week whose Sunday starts a new calendar month, so the row above the grid
 * reads like a normal month axis instead of repeating 53 times.
 */
export function monthLabels(window: DayWindow): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let lastMonth = -1;
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const sunday = addDays(window.from, week * 7);
    const month = Number(sunday.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      labels.push({ column: week, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  }
  return labels;
}
