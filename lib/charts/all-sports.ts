/**
 * The Training tab's cross-sport charts (the Shared section under All) and the cycling power
 * zones. Every builder works off the sport list in lib/sport.ts, so a sport added there (swimming,
 * from 2027) shows up in the stacks, dots and lines without changes here. Pure, unit-tested.
 */
import type { DashboardData } from "@/lib/dashboard/types";
import type { Activity } from "@/lib/data/activities";
import { eachDay, type LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { inSport, sportOf, SPORTS, type ActiveSport, type SportFilter } from "@/lib/sport";
import { weeklyBuckets } from "./weekly-buckets";

type Data = Pick<DashboardData, "activities" | "dateRange" | "today"> & { sport?: SportFilter };

const hoursOf = (a: Activity) => (a.moving_duration_s ?? a.duration_s) / 3600;

/** The tracked activities under a filter (the page's own by default), inside the range. */
function inRangeFor(data: Data, sport: SportFilter = data.sport ?? "all"): Activity[] {
  return data.activities.filter((a) => inSport(a, sport) && isInRange(a.local_date, data.dateRange));
}

/** The sports with any activity in the range, in SPORTS order. */
export function sportsInRange(data: Data): ActiveSport[] {
  const seen = new Set(inRangeFor(data, "all").map((a) => sportOf(a.activity_type)));
  return SPORTS.filter((s) => seen.has(s));
}

// ---------- Power zones (cycling) ----------

/** Coggan's seven power zones, as Garmin numbers them against the FTP set in Garmin Connect. */
export const POWER_ZONE_NAMES = ["Recovery", "Endurance", "Tempo", "Threshold", "VO2 max", "Anaerobic", "Sprint"] as const;

export interface PowerZonesData {
  zones: { label: string; name: string; minutes: number; share: number }[];
  totalMinutes: number;
  rides: number;
}

/** Minutes in each of Garmin's power zones across the range's rides that recorded power zones. */
export function buildPowerZones(data: Data): PowerZonesData | null {
  const rides = inRangeFor(data, "ride").filter((a) => a.power_zone_s && a.power_zone_s.length > 0);
  if (rides.length === 0) return null;
  const seconds = POWER_ZONE_NAMES.map((_, i) => rides.reduce((sum, r) => sum + (r.power_zone_s![i] ?? 0), 0));
  const total = seconds.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  return {
    zones: POWER_ZONE_NAMES.map((name, i) => ({ label: `Z${i + 1}`, name, minutes: seconds[i] / 60, share: seconds[i] / total })),
    totalMinutes: total / 60,
    rides: rides.length,
  };
}

// ---------- Weekly volume by sport ----------

/** Ranges up to this long get a bar per day; longer ones a bar per week. */
const DAILY_VOLUME_MAX_DAYS = 14;

export interface VolumeBar {
  /** A day, or a week's first day. */
  label: LocalDate;
  hours: Record<ActiveSport, number>;
  total: number;
  /** Sum of Garmin's training load for the bar's activities. */
  load: number;
}

export interface WeeklyVolumeData {
  weekly: boolean;
  bars: VolumeBar[];
  /** The sports drawn, in SPORTS order (those with any hours in range). */
  sports: ActiveSport[];
  totalHours: number;
  hoursBySport: Record<ActiveSport, number>;
  /** Average hours per week across the range (complete or not). */
  hoursPerWeek: number;
}

const zeroHours = (): Record<ActiveSport, number> => Object.fromEntries(SPORTS.map((s) => [s, 0])) as Record<ActiveSport, number>;

/** Hours trained per day or week, stacked by sport, with each bar's total Garmin load. */
export function buildWeeklyVolume(data: Data): WeeklyVolumeData | null {
  const activities = inRangeFor(data);
  if (activities.length === 0) return null;
  const days = eachDay(data.dateRange.from, data.dateRange.to);
  const weekly = days.length > DAILY_VOLUME_MAX_DAYS;
  const groups = weekly ? weeklyBuckets(data.dateRange) : days.map((d) => [d]);
  const dayOf = new Map<LocalDate, Activity[]>();
  for (const a of activities) dayOf.set(a.local_date, [...(dayOf.get(a.local_date) ?? []), a]);

  const bars: VolumeBar[] = groups.map((group) => {
    const hours = zeroHours();
    let load = 0;
    for (const d of group) {
      for (const a of dayOf.get(d) ?? []) {
        hours[sportOf(a.activity_type) as ActiveSport] += hoursOf(a);
        load += a.training_load ?? 0;
      }
    }
    return { label: group[0], hours, total: SPORTS.reduce((s, k) => s + hours[k], 0), load };
  });
  const hoursBySport = zeroHours();
  for (const b of bars) for (const s of SPORTS) hoursBySport[s] += b.hours[s];
  const totalHours = SPORTS.reduce((s, k) => s + hoursBySport[k], 0);
  return {
    weekly,
    bars,
    sports: SPORTS.filter((s) => hoursBySport[s] > 0),
    totalHours,
    hoursBySport,
    hoursPerWeek: totalHours / Math.max(1, days.length / 7),
  };
}

// ---------- What your sessions trained ----------

/** Garmin's primary training benefit labels, easiest first, with the words shown. */
export const BENEFITS = [
  { key: "RECOVERY", label: "Recovery" },
  { key: "AEROBIC_BASE", label: "Base" },
  { key: "TEMPO", label: "Tempo" },
  { key: "LACTATE_THRESHOLD", label: "Threshold" },
  { key: "VO2MAX", label: "VO2 max" },
  { key: "ANAEROBIC_CAPACITY", label: "Anaerobic" },
  { key: "SPRINT", label: "Sprint" },
] as const;

export interface MixSession {
  id: string;
  name: string;
  sport: ActiveSport;
  date: LocalDate;
}

export interface SessionMixData {
  weeks: LocalDate[];
  /** One row per benefit, in BENEFITS order, each with a cell per week. */
  rows: { key: string; label: string; cells: MixSession[][] }[];
  /** Share of sessions with a label that were Recovery, Base or Tempo against the harder ones. */
  counts: { easy: number; tempo: number; hard: number };
  sports: ActiveSport[];
}

