import type { DashboardData } from "@/lib/dashboard/types";
import { LOAD_FOCUS_KEYS, type DailyTraining, type LoadFocusKey } from "@/lib/data/training";
import { addDays, eachDay, type LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { inSport, type ActiveSport } from "@/lib/sport";

// ---------- Easy vs hard ----------

/** The design's target: 80% of training time easy (zones 1 and 2), riding or running. */
export const EASY_SHARE_AIM = 0.8;
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

/**
 * One sport's share of the load, which Garmin doesn't split: from each activity's own Garmin
 * training load, acute is the 7-day sum and chronic the weekly average over 4 weeks (the same
 * shape as Garmin's numbers, so the ratio reads the same). No optimal band or status: those are
 * Garmin's, for every sport together.
 */
export function buildSportLoad(
  data: Pick<DashboardData, "activities" | "dateRange" | "today">,
  sport: ActiveSport,
): TrainingLoadData | null {
  const loadByDate = new Map<LocalDate, number>();
  for (const a of data.activities) {
    if (a.training_load === null || !inSport(a, sport)) continue;
    loadByDate.set(a.local_date, (loadByDate.get(a.local_date) ?? 0) + a.training_load);
  }
  if (loadByDate.size === 0) return null;
  const sumOver = (end: LocalDate, days: number) => {
    let sum = 0;
    for (let i = 0; i < days; i++) sum += loadByDate.get(addDays(end, -i)) ?? 0;
    return sum;
  };
  const end = data.dateRange.to < data.today ? data.dateRange.to : data.today;
  if (end < data.dateRange.from) return null;
  const points: LoadPoint[] = eachDay(data.dateRange.from, end).map((date) => ({
    date,
    acute: sumOver(date, 7),
    chronic: sumOver(date, 28) / 4,
    low: null,
    high: null,
  }));
  if (points.every((p) => p.acute === 0 && p.chronic === 0)) return null;
  const last = points.at(-1)!;
  // A ratio needs a full four weeks of the sport behind it: in a sport's first weeks the chronic
  // side is mostly empty days, and every session reads as a spike.
  const firstDay = [...loadByDate.keys()].sort()[0];
  const acwr = last.chronic > 0 && firstDay <= addDays(last.date, -27) ? last.acute / last.chronic : null;
  return {
    points,
    latest: {
      date: last.date,
      acute: last.acute,
      chronic: last.chronic,
      low: null,
      high: null,
      acwr,
      acwrState: acwr === null ? null : acwr < ACWR_RANGE[0] ? "low" : acwr > ACWR_RANGE[1] ? "high" : "optimal",
      status: null,
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
