import type { DashboardData } from "@/lib/dashboard/types";
import type { DailyRecovery } from "@/lib/data/recovery";
import { eachDay, type LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { WELLNESS_WEEKLY_THRESHOLD_DAYS } from "./sleep";
import { weeklyBuckets } from "./weekly-buckets";

export interface BatteryBar {
  /** The day, or the week's first day when weekly. */
  label: LocalDate;
  high: number;
  low: number;
  wake: number | null;
}

export interface BodyBatteryData {
  weekly: boolean;
  bars: BatteryBar[];
  latestWake: number | null;
  avgWake: number | null;
  /** The first day in the range with a Body Battery range (for the "data starts" note). */
  dataFrom: LocalDate;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Each day's Body Battery range (high to low) and its value at wake; weekly means past 35 days. */
export function buildBodyBattery(data: Pick<DashboardData, "recovery" | "dateRange">): BodyBatteryData | null {
  const days = data.recovery.filter(
    (r) => isInRange(r.local_date, data.dateRange) && r.body_battery_high !== null && r.body_battery_low !== null,
  );
  if (days.length === 0) return null;

  const weekly = eachDay(data.dateRange.from, data.dateRange.to).length > WELLNESS_WEEKLY_THRESHOLD_DAYS;
  const toBar = (label: LocalDate, rows: DailyRecovery[]): BatteryBar => {
    const wakes = rows.flatMap((r) => (r.body_battery_wake === null ? [] : [r.body_battery_wake]));
    return {
      label,
      high: mean(rows.map((r) => r.body_battery_high!)),
      low: mean(rows.map((r) => r.body_battery_low!)),
      wake: wakes.length ? mean(wakes) : null,
    };
  };

  const byDate = new Map(days.map((r) => [r.local_date, r]));
  const bars = weekly
    ? weeklyBuckets(data.dateRange).flatMap((week) => {
        const rows = week.flatMap((d) => byDate.get(d) ?? []);
        return rows.length ? [toBar(week[0], rows)] : [];
      })
    : days.map((r) => toBar(r.local_date, [r]));

  const wakes = days.flatMap((r) => (r.body_battery_wake === null ? [] : [r.body_battery_wake]));
  return {
    weekly,
    bars,
    latestWake: wakes.at(-1) ?? null,
    avgWake: wakes.length ? mean(wakes) : null,
    dataFrom: days[0].local_date,
  };
}
