import { z } from "zod";

/**
 * A calendar day as 'YYYY-MM-DD'. Always a day in the athlete's own timezone (see
 * timezone.ts), never a UTC date. Everything in this file is timezone-free calendar math,
 * done in UTC only because UTC has no daylight-saving gaps.
 */
export type LocalDate = string;

export const localDateSchema = z.iso.date();

export interface DayWindow {
  from: LocalDate;
  to: LocalDate;
}

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** UTC midnight of a local date. Rejects impossible dates such as 2026-02-30. */
export function dayStartUtcMs(date: LocalDate): number {
  const m = FORMAT.exec(date);
  if (m) {
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (fromUtcMs(ms) === date) return ms;
  }
  throw new Error(`Invalid local date "${date}"`);
}

export function assertLocalDate(value: string): void {
  dayStartUtcMs(value);
}

export function isLocalDate(value: string): boolean {
  try {
    dayStartUtcMs(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(dayStartUtcMs(date) + days * DAY_MS);
}

/** Calendar months, clamping to the end of a shorter month (Aug 31 - 6 months = Feb 28). */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const start = new Date(dayStartUtcMs(date));
  const total = start.getUTCFullYear() * 12 + start.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromUtcMs(Date.UTC(year, month, Math.min(start.getUTCDate(), daysInMonth)));
}

/** Whole days from `earlier` to `later` (negative when `later` is before `earlier`). */
export function diffDays(later: LocalDate, earlier: LocalDate): number {
  return Math.round((dayStartUtcMs(later) - dayStartUtcMs(earlier)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday, matching profiles.shot_weekday. */
export function weekdayOf(date: LocalDate): number {
  return new Date(dayStartUtcMs(date)).getUTCDay();
}

/** The Sunday on or before `date`; the heatmap's weeks start on Sunday. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekdayOf(date));
}

/** Every day from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const count = diffDays(to, from) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) => addDays(from, i));
}
