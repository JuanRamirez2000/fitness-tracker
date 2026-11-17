import type { DashboardData } from "@/lib/dashboard/types";
import { MOOD_SCALES, type MoodLog, type MoodScale, type SoreArea } from "@/lib/data/mood";
import { eachDay, type LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { WELLNESS_WEEKLY_THRESHOLD_DAYS } from "./sleep";
import { weeklyBuckets } from "./weekly-buckets";

export interface MoodPoint {
  /** The day, or the week's first day when weekly. */
  label: LocalDate;
  /** Each 1-5 answer (a weekly mean when weekly); null where nothing was logged. */
  values: Record<MoodScale, number | null>;
  /** Days in this point marked sick or injured (0 or 1 for a single day). */
  sickDays: number;
  injuredDays: number;
  areas: SoreArea[];
  /** Logged days behind this point. */
  logs: number;
}

export interface MoodTrend {
  weekly: boolean;
  points: MoodPoint[];
  averages: Record<MoodScale, number | null>;
  /** Days logged out of the days in the range up to today. */
  loggedDays: number;
  rangeDays: number;
  offDays: number;
  /** The first logged day in the range (for the "log starts" note). */
  dataFrom: LocalDate;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function toPoint(label: LocalDate, logs: MoodLog[]): MoodPoint {
  const values = Object.fromEntries(
    MOOD_SCALES.map((k) => [k, mean(logs.flatMap((l) => (l[k] === null ? [] : [l[k]!])))]),
  ) as MoodPoint["values"];
  return {
    label,
    values,
    sickDays: logs.filter((l) => l.sick).length,
    injuredDays: logs.filter((l) => l.injured).length,
    areas: [...new Set(logs.flatMap((l) => l.sore_areas))],
    logs: logs.length,
  };
}

/** The mood log over the range: daily points, or weekly means past 35 days. Pure. */
export function buildMoodTrend(data: Pick<DashboardData, "moodLogs" | "dateRange" | "today">): MoodTrend | null {
  const to = data.dateRange.to < data.today ? data.dateRange.to : data.today;
  const window = { from: data.dateRange.from, to };
  const logs = data.moodLogs.filter((l) => isInRange(l.local_date, window));
  if (logs.length === 0) return null;

  const rangeDays = eachDay(window.from, window.to).length;
  const weekly = eachDay(data.dateRange.from, data.dateRange.to).length > WELLNESS_WEEKLY_THRESHOLD_DAYS;
  const byDate = new Map(logs.map((l) => [l.local_date, l]));
  const points = weekly
    ? weeklyBuckets(window).flatMap((week) => {
        const rows = week.flatMap((d) => byDate.get(d) ?? []);
        return rows.length ? [toPoint(week[0], rows)] : [];
      })
    : logs.map((l) => toPoint(l.local_date, [l]));

  return {
    weekly,
    points,
    averages: toPoint(window.from, logs).values,
    loggedDays: logs.length,
    rangeDays,
    offDays: logs.filter((l) => l.sick || l.injured).length,
    dataFrom: logs[0].local_date,
  };
}
