import { dayStartUtcMs, type LocalDate } from "./calendar";

/*
 * local_date is the day in profiles.timezone. It must never be derived from a UTC date
 * string: 8pm on Sep 20 in Los Angeles is already Sep 21 in UTC. Every conversion here
 * goes through Intl so daylight-saving rules come from the platform's tz database.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      // h23 rather than hour12:false, which prints midnight as "24" in some engines.
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function toInstant(value: Date | string): Date {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid timestamp "${String(value)}"`);
  return instant;
}

/** The calendar day of `instant` as seen in `timeZone`. */
export function localDateIn(instant: Date | string, timeZone: string): LocalDate {
  const { year, month, day } = wallClock(toInstant(instant), timeZone);
  return [year, month, day].map((n, i) => String(n).padStart(i === 0 ? 4 : 2, "0")).join("-");
}

export function todayIn(timeZone: string, now: Date = new Date()): LocalDate {
  return localDateIn(now, timeZone);
}

/** Minutes east of UTC that `timeZone` is at `instant` (Los Angeles: -420 in summer). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((wallAsUtc - wholeSeconds) / 60_000);
}

/**
 * The instant at which clocks in `timeZone` read `hour:minute` on `date`. Used to give a
 * backfilled entry a measured_at that still lands on the intended local_date.
 */
export function instantAt(date: LocalDate, hour: number, minute: number, timeZone: string): Date {
  const wallAsUtc = dayStartUtcMs(date) + (hour * 60 + minute) * 60_000;
  const first = wallAsUtc - offsetMinutes(new Date(wallAsUtc), timeZone) * 60_000;
  // The offset can differ at the corrected instant when a daylight-saving change falls
  // between the two, so measure it again there.
  return new Date(wallAsUtc - offsetMinutes(new Date(first), timeZone) * 60_000);
}
