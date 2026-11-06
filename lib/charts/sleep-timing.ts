import type { DashboardData } from "@/lib/dashboard/types";
import type { SleepNight } from "@/lib/data/recovery";
import { addDays, eachDay, type LocalDate } from "@/lib/dates/calendar";
import { minuteOfDayIn } from "@/lib/dates/timezone";
import { isInRange } from "@/lib/heatmap/cell-state";
import { WELLNESS_WEEKLY_THRESHOLD_DAYS, bedtimeMinutes } from "./sleep";
import { weeklyBuckets } from "./weekly-buckets";

export interface TimingBar {
  /** The night's wake-up day, or the week's first day when weekly. */
  label: LocalDate;
  /** Minutes from midnight: bedtime negative before midnight (-60 = 11 pm), wake time positive. */
  bed: number;
  wake: number;
  hours: number;
  needHours: number | null;
  /** Nights averaged into a weekly bar (1 for a night). */
  nights: number;
}

export interface SleepTimingData {
  weekly: boolean;
  bars: TimingBar[];
  medianBed: number;
  medianWake: number;
  /** How much bedtime moves night to night: the standard deviation, in minutes. */
  bedSpread: number;
  /** Hours short of need over the 7 nights ending each night in range (negative: ahead). */
  debt: { date: LocalDate; hours: number }[];
  dataFrom: LocalDate;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const timed = (n: SleepNight) => n.bedtime !== null && n.wake_time !== null && (n.duration_s ?? 0) > 0;

/** Bedtime and wake time per night (weekly means past 35 days), how steady bedtime is, and the running 7-night sleep debt. Pure. */
export function buildSleepTiming(data: Pick<DashboardData, "sleep" | "dateRange" | "profile" | "today">): SleepTimingData | null {
  const tz = data.profile.timezone;
  const all = data.sleep.filter((n) => n.local_date <= data.today);
  const nights = all.filter((n) => isInRange(n.local_date, data.dateRange) && timed(n));
  if (!nights.length) return null;

  const toBar = (label: LocalDate, ns: SleepNight[]): TimingBar => {
    const needs = ns.flatMap((n) => (n.need_s === null ? [] : [n.need_s / 3600]));
    return {
      label,
      bed: mean(ns.map((n) => bedtimeMinutes(n.bedtime!, tz))),
      wake: mean(ns.map((n) => minuteOfDayIn(n.wake_time!, tz))),
      hours: mean(ns.map((n) => n.duration_s! / 3600)),
      needHours: needs.length ? mean(needs) : null,
      nights: ns.length,
    };
  };
  const weekly = eachDay(data.dateRange.from, data.dateRange.to).length > WELLNESS_WEEKLY_THRESHOLD_DAYS;
  const byDate = new Map(nights.map((n) => [n.local_date, n]));
  const bars = weekly
    ? weeklyBuckets(data.dateRange).flatMap((week) => {
        const ns = week.flatMap((d) => byDate.get(d) ?? []);
        return ns.length ? [toBar(week[0], ns)] : [];
      })
    : nights.map((n) => toBar(n.local_date, [n]));

  const beds = nights.map((n) => bedtimeMinutes(n.bedtime!, tz));
  const avgBed = mean(beds);
  const debt = nights.map((n) => {
    const week = all.filter((m) => m.local_date <= n.local_date && m.local_date > addDays(n.local_date, -7) && (m.duration_s ?? 0) > 0 && m.need_s !== null);
    return { date: n.local_date, hours: week.reduce((s, m) => s + (m.need_s! - m.duration_s!) / 3600, 0) };
  });

  return {
    weekly,
    bars,
    medianBed: median(beds),
    medianWake: median(nights.map((n) => minuteOfDayIn(n.wake_time!, tz))),
    bedSpread: Math.sqrt(mean(beds.map((b) => (b - avgBed) ** 2))),
    debt,
    dataFrom: nights[0].local_date,
  };
}
