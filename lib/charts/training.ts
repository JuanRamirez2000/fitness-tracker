import type { DashboardData } from "@/lib/dashboard/types";
import { LOAD_FOCUS_KEYS, type DailyTraining, type LoadFocusKey } from "@/lib/data/training";
import { addDays, eachDay, type LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { runMiles, runsOf } from "@/lib/running/runs";
import { weeklyBuckets } from "./weekly-buckets";

// ---------- Time in HR zones ----------

/** The design's target: 80% of running time easy (zones 1 and 2). */
export const EASY_SHARE_AIM = 0.8;
/** Ranges up to this long show one bar per day; longer ones one per week. */
const DAILY_ZONE_BARS_MAX_DAYS = 7;

export interface ZoneBar {
  /** A day, or a week's first day. */
  label: LocalDate;
  /** Minutes in Z1..Z5. */
  minutes: [number, number, number, number, number];
  /** Miles run in this bar's day or week (every run, with or without HR). */
  miles: number;
}

export interface ZoneChartData {
  weekly: boolean;
  bars: ZoneBar[];
  /** (Z1 + Z2) / all, over the range and over the last 7 days ending today. */
  easyShare: number;
  easyShareLast7: number | null;
  totalMinutes: number;
  /** Miles and runs in the range (every run), folded in from the old running volume card. */
  totalMiles: number;
  runCount: number;
  /** Garmin's own zone bounds, [low, high] bpm, when imported. */
  bounds: [number, number][] | null;
}

type Zones = [number, number, number, number, number];
const ZERO: Zones = [0, 0, 0, 0, 0];
const add = (a: Zones, b: readonly number[]): Zones => a.map((v, i) => v + (b[i] ?? 0)) as Zones;
const easyShareOf = (z: Zones) => {
  const total = z.reduce((s, v) => s + v, 0);
  return total > 0 ? (z[0] + z[1]) / total : null;
};

/** Time in each HR zone across runs, stacked per day (a week or less) or per week, with the miles run. */
export function buildZoneChart(data: Pick<DashboardData, "activities" | "dateRange" | "today" | "profile">): ZoneChartData | null {
  const allRuns = runsOf(data.activities);
  const runs = allRuns.filter((r) => r.hr_zone_s !== null);
  const inRange = runs.filter((r) => isInRange(r.local_date, data.dateRange));
  const runsInRange = allRuns.filter((r) => isInRange(r.local_date, data.dateRange));
  if (runsInRange.length === 0) return null;

  const secondsByDate = new Map<LocalDate, Zones>();
  for (const r of inRange) secondsByDate.set(r.local_date, add(secondsByDate.get(r.local_date) ?? ZERO, r.hr_zone_s!));
  const milesByDate = new Map<LocalDate, number>();
  for (const r of runsInRange) milesByDate.set(r.local_date, (milesByDate.get(r.local_date) ?? 0) + runMiles(r));
  const toMinutes = (z: Zones) => z.map((s) => s / 60) as Zones;
  const milesOf = (days: LocalDate[]) => days.reduce((sum, d) => sum + (milesByDate.get(d) ?? 0), 0);

  const weekly = eachDay(data.dateRange.from, data.dateRange.to).length > DAILY_ZONE_BARS_MAX_DAYS;
  const bars: ZoneBar[] = weekly
    ? weeklyBuckets(data.dateRange).map((week) => ({
        label: week[0],
        minutes: toMinutes(week.reduce((acc, d) => add(acc, secondsByDate.get(d) ?? ZERO), ZERO)),
        miles: milesOf(week),
      }))
    : eachDay(data.dateRange.from, data.dateRange.to).map((d) => ({
        label: d,
        minutes: toMinutes(secondsByDate.get(d) ?? ZERO),
        miles: milesOf([d]),
      }));

  const rangeTotal = inRange.reduce((acc, r) => add(acc, r.hr_zone_s!), ZERO);
  const last7 = { from: addDays(data.today, -6), to: data.today };
  const last7Total = runs.filter((r) => isInRange(r.local_date, last7)).reduce((acc, r) => add(acc, r.hr_zone_s!), ZERO);

  return {
    weekly,
    bars,
    easyShare: easyShareOf(rangeTotal) ?? 0,
    easyShareLast7: easyShareOf(last7Total),
    totalMinutes: rangeTotal.reduce((s, v) => s + v, 0) / 60,
    totalMiles: milesOf([...milesByDate.keys()]),
    runCount: runsInRange.length,
    bounds: data.profile.hr_zone_bounds,
  };
}

// ---------- Training load ----------

export type StatusTone = "good" | "neutral" | "bad";

/** Garmin's training status words, with a glyph so the state never rests on color. */
const STATUS: Record<string, { label: string; glyph: string; tone: StatusTone }> = {
  PRODUCTIVE: { label: "Productive", glyph: "▲", tone: "good" },
  PEAKING: { label: "Peaking", glyph: "▲", tone: "good" },
  MAINTAINING: { label: "Maintaining", glyph: "●", tone: "neutral" },
  RECOVERY: { label: "Recovery", glyph: "●", tone: "neutral" },
  UNPRODUCTIVE: { label: "Unproductive", glyph: "▼", tone: "bad" },
  STRAINED: { label: "Strained", glyph: "▼", tone: "bad" },
  OVERREACHING: { label: "Overreaching", glyph: "▼", tone: "bad" },
  DETRAINING: { label: "Detraining", glyph: "▼", tone: "bad" },
};

export function trainingStatus(status: string | null): { label: string; glyph: string; tone: StatusTone } | null {
  if (!status) return null;
  return STATUS[status] ?? { label: status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " "), glyph: "○", tone: "neutral" };
}

/** Garmin's healthy acute:chronic workload ratio. */
export const ACWR_RANGE: [number, number] = [0.8, 1.5];

export interface LoadPoint {
  date: LocalDate;
  acute: number;
  chronic: number;
  low: number | null;
  high: number | null;
}

export interface TrainingLoadData {
  points: LoadPoint[];
  latest: {
    date: LocalDate;
    acute: number;
    chronic: number;
    low: number | null;
    high: number | null;
    acwr: number | null;
    acwrState: "low" | "optimal" | "high" | null;
    status: ReturnType<typeof trainingStatus>;
  };
  dataFrom: LocalDate;
}

function latestWith(rows: DailyTraining[], today: LocalDate, has: (r: DailyTraining) => boolean): DailyTraining | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].local_date <= today && has(rows[i])) return rows[i];
  return null;
}

export function buildTrainingLoad(data: Pick<DashboardData, "training" | "dateRange" | "today">): TrainingLoadData | null {
  const points = data.training
    .filter((r) => isInRange(r.local_date, data.dateRange) && r.acute_load !== null && r.chronic_load !== null)
    .map((r) => ({ date: r.local_date, acute: r.acute_load!, chronic: r.chronic_load!, low: r.chronic_low, high: r.chronic_high }));
  const latest = latestWith(data.training, data.today, (r) => r.acute_load !== null && r.chronic_load !== null);
  if (points.length === 0 || !latest) return null;

  const acwr = latest.acwr;
  return {
    points,
    latest: {
      date: latest.local_date,
      acute: latest.acute_load!,
      chronic: latest.chronic_load!,
      low: latest.chronic_low,
      high: latest.chronic_high,
      acwr,
      acwrState: acwr === null ? null : acwr < ACWR_RANGE[0] ? "low" : acwr > ACWR_RANGE[1] ? "high" : "optimal",
      status: trainingStatus(latest.status),
    },
    dataFrom: points[0].date,
  };
}

// ---------- Load focus ----------

export const FOCUS_LABELS: Record<LoadFocusKey, string> = {
  aerobic_low: "Aerobic low",
  aerobic_high: "Aerobic high",
  anaerobic: "Anaerobic",
};

export type FocusState = "above" | "in" | "below";
export const FOCUS_GLYPH: Record<FocusState, string> = { above: "▲", in: "●", below: "▼" };
export const FOCUS_WORD: Record<FocusState, string> = { above: "above", in: "in range", below: "below" };

export interface FocusBar {
  key: LoadFocusKey;
  label: string;
  value: number;
  low: number;
  high: number;
  state: FocusState;
}

export interface LoadFocusData {
  date: LocalDate;
  bars: FocusBar[];
  /** The scale's top: the largest value or target, so every bar fits. */
  max: number;
  feedback: string | null;
}

/** Garmin's rolling 4-week load per focus, against Garmin's own target range for each. */
export function buildLoadFocus(data: Pick<DashboardData, "training" | "today">): LoadFocusData | null {
  const row = latestWith(data.training, data.today, (r) => r.focus !== null);
  if (!row?.focus) return null;
  const bars = LOAD_FOCUS_KEYS.flatMap((key): FocusBar[] => {
    const part = row.focus![key];
    if (!part || part.value === null || part.low === null || part.high === null) return [];
    const state: FocusState = part.value > part.high ? "above" : part.value < part.low ? "below" : "in";
    return [{ key, label: FOCUS_LABELS[key], value: part.value, low: part.low, high: part.high, state }];
  });
  if (bars.length === 0) return null;
  return {
    date: row.local_date,
    bars,
    max: Math.max(...bars.flatMap((b) => [b.value, b.high])) * 1.08,
    feedback: row.focus_feedback,
  };
}
