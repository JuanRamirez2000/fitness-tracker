import type { DashboardData } from "@/lib/dashboard/types";
import type { SleepNight } from "@/lib/data/recovery";
import { eachDay, type LocalDate } from "@/lib/dates/calendar";
import { minuteOfDayIn } from "@/lib/dates/timezone";
import { isInRange } from "@/lib/heatmap/cell-state";
import { weeklyBuckets } from "./weekly-buckets";

/** Ranges longer than this show weekly means instead of one bar per night. */
export const WELLNESS_WEEKLY_THRESHOLD_DAYS = 35;

export const SLEEP_STAGES = ["deep", "rem", "light", "awake"] as const;
export type SleepStage = (typeof SLEEP_STAGES)[number];

export interface SleepBar {
  /** The night's wake-up day, or the week's first day when weekly. */
  label: LocalDate;
  /** Hours per stage (a weekly bar: the mean over that week's nights). */
  hours: Record<SleepStage, number>;
  /** Asleep hours (deep + REM + light), the bar height minus awake. */
  asleep: number;
}

export interface SleepPoint {
  label: LocalDate;
  value: number;
}

export interface SleepChartData {
  weekly: boolean;
  bars: SleepBar[];
  /** Garmin's sleep need, averaged over the range's nights. */
  needHours: number | null;
  lastNight: { date: LocalDate; hours: number; score: number | null } | null;
  avgHours: number;
  /** Sleep score 0..100 per night (or weekly mean). */
  scores: SleepPoint[];
  /**
   * Bedtime per night as minutes from local midnight: negative before midnight (-60 = 11 pm),
   * positive after (75 = 1:15 am). The chart draws later as lower.
   */
  bedtimes: SleepPoint[];
  nights: number;
  /** The first night in the range (for the "data starts" note). */
  dataFrom: LocalDate;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Minutes from midnight with bedtimes after noon counted as the evening before. */
export function bedtimeMinutes(bedtime: string, timeZone: string): number {
  const m = minuteOfDayIn(bedtime, timeZone);
  return m >= 12 * 60 ? m - 24 * 60 : m;
}

function stageHours(n: SleepNight): Record<SleepStage, number> {
  return { deep: (n.deep_s ?? 0) / 3600, rem: (n.rem_s ?? 0) / 3600, light: (n.light_s ?? 0) / 3600, awake: (n.awake_s ?? 0) / 3600 };
}

function toBar(label: LocalDate, nights: SleepNight[]): SleepBar {
  const per = nights.map(stageHours);
  const hours = Object.fromEntries(SLEEP_STAGES.map((s) => [s, mean(per.map((h) => h[s]))])) as Record<SleepStage, number>;
  return { label, hours, asleep: hours.deep + hours.rem + hours.light };
}

export function buildSleepChart(data: Pick<DashboardData, "sleep" | "dateRange" | "profile">): SleepChartData | null {
  const tz = data.profile.timezone;
  const nights = data.sleep.filter((n) => isInRange(n.local_date, data.dateRange) && (n.duration_s ?? 0) > 0);
  if (nights.length === 0) return null;

  const byDate = new Map(nights.map((n) => [n.local_date, n]));
  const weekly = eachDay(data.dateRange.from, data.dateRange.to).length > WELLNESS_WEEKLY_THRESHOLD_DAYS;
  const groups: [LocalDate, SleepNight[]][] = weekly
    ? weeklyBuckets(data.dateRange)
        .map((week): [LocalDate, SleepNight[]] => [week[0], week.flatMap((d) => byDate.get(d) ?? [])])
        .filter(([, ns]) => ns.length > 0)
    : nights.map((n): [LocalDate, SleepNight[]] => [n.local_date, [n]]);

  const scored = (ns: SleepNight[]) => ns.flatMap((n) => (n.score === null ? [] : [n.score]));
  const withBedtime = (ns: SleepNight[]) => ns.flatMap((n) => (n.bedtime ? [bedtimeMinutes(n.bedtime, tz)] : []));
  const needs = nights.flatMap((n) => (n.need_s === null ? [] : [n.need_s / 3600]));
  const last = nights[nights.length - 1];

  return {
    weekly,
    bars: groups.map(([label, ns]) => toBar(label, ns)),
    needHours: needs.length ? mean(needs) : null,
    lastNight: { date: last.local_date, hours: (last.duration_s ?? 0) / 3600, score: last.score },
    avgHours: mean(nights.map((n) => (n.duration_s ?? 0) / 3600)),
    scores: groups.flatMap(([label, ns]) => (scored(ns).length ? [{ label, value: mean(scored(ns)) }] : [])),
    bedtimes: groups.flatMap(([label, ns]) => (withBedtime(ns).length ? [{ label, value: mean(withBedtime(ns)) }] : [])),
    nights: nights.length,
    dataFrom: nights[0].local_date,
  };
}

/** Hours to one decimal, as the design writes them ("7.5 h"). */
export function fmtHours(hours: number): string {
  return hours.toFixed(1);
}

/** -60 -> "11 pm", 75 -> "1:15 am". */
export function fmtBedtime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h % 12 || 12}${min ? `:${String(min).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}
