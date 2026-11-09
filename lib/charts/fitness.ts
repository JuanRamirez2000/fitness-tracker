import type { DashboardData } from "@/lib/dashboard/types";
import type { DailyTraining } from "@/lib/data/training";
import type { LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";

export interface DatedValue {
  date: LocalDate;
  value: number;
}

// ---------- VO2 max and fitness age ----------

export type FactorTag = "largest lever" | "lever" | "on target" | "context";

export interface FitnessFactor {
  key: string;
  label: string;
  /** Display-ready: "33.8%", "65.5 min". */
  value: string;
  target: string | null;
  /** The fitness age reaching the target would give, when Garmin says. */
  potentialAge: number | null;
  tag: FactorTag;
}

export interface FitnessData {
  vo2: DatedValue[];
  vo2Latest: number | null;
  vo2Delta: number | null;
  fitnessAge: DatedValue[];
  fitnessAgeLatest: number | null;
  realAge: number | null;
  achievableAge: number | null;
  factors: FitnessFactor[];
}

/** Garmin's fitness age components: label, unit, and whether lower is better. */
const FACTOR_META: Record<string, { label: string; unit: string; lowerIsBetter: boolean; digits: number }> = {
  bodyFat: { label: "Body fat", unit: "%", lowerIsBetter: true, digits: 1 },
  vigorousMinutesAvg: { label: "Vigorous minutes a week", unit: " min", lowerIsBetter: false, digits: 0 },
  vigorousDaysAvg: { label: "Vigorous days a week", unit: " days", lowerIsBetter: false, digits: 0 },
  rhr: { label: "Resting HR", unit: " bpm", lowerIsBetter: true, digits: 0 },
  bmi: { label: "BMI", unit: "", lowerIsBetter: true, digits: 1 },
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * "What would lower fitness age": Garmin's own components, ranked by Garmin's priority (1 =
 * largest lever). A factor already at its target says so; one without a target (resting HR)
 * is context. Nothing here is computed beyond comparing Garmin's value with Garmin's target.
 */
export function rankFactors(components: Record<string, unknown> | null): FitnessFactor[] {
  if (!components) return [];
  const entries = Object.entries(components).flatMap(([key, raw]) => {
    if (!raw || typeof raw !== "object") return [];
    const c = raw as Record<string, unknown>;
    const value = num(c.value);
    if (value === null) return [];
    const meta = FACTOR_META[key] ?? { label: key, unit: "", lowerIsBetter: true, digits: 1 };
    const target = num(c.targetValue);
    const priority = num(c.priority);
    const met = target !== null && (meta.lowerIsBetter ? value <= target : value >= target);
    const fmt = (v: number) => `${v.toFixed(meta.digits)}${meta.unit}`;
    return [{ key, priority, met, value, target, meta, potentialAge: num(c.potentialAge), fmt }];
  });
  entries.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  return entries.map((e) => ({
    key: e.key,
    label: e.meta.label,
    value: e.fmt(e.value),
    target: e.target === null ? null : e.fmt(e.target),
    potentialAge: e.potentialAge,
    tag: e.met ? "on target" : e.priority === 1 ? "largest lever" : e.priority !== null ? "lever" : "context",
  }));
}

const series = (rows: DailyTraining[], pick: (r: DailyTraining) => number | null): DatedValue[] =>
  rows.flatMap((r) => {
    const value = pick(r);
    return value === null ? [] : [{ date: r.local_date, value }];
  });

/** VO2 max and fitness age; `cycling` charts Garmin's cycling VO2 max instead of its running one. */
export function buildFitness(
  data: Pick<DashboardData, "training" | "dateRange" | "today">,
  { cycling = false }: { cycling?: boolean } = {},
): FitnessData | null {
  const upToToday = data.training.filter((r) => r.local_date <= data.today);
  const inRange = upToToday.filter((r) => isInRange(r.local_date, data.dateRange));
  const pickVo2 = (r: DailyTraining) => (cycling ? r.vo2max_cycling : r.vo2max);
  const vo2 = series(inRange, pickVo2);
  const fitnessAge = series(inRange, (r) => r.fitness_age);
  if (vo2.length === 0 && fitnessAge.length === 0) return null;

  const latestAge = [...upToToday].reverse().find((r) => r.fitness_age !== null);
  const allVo2 = series(upToToday, pickVo2);
  return {
    vo2,
    vo2Latest: allVo2.at(-1)?.value ?? null,
    vo2Delta: vo2.length >= 2 ? vo2[vo2.length - 1].value - vo2[0].value : null,
    fitnessAge,
    fitnessAgeLatest: latestAge?.fitness_age ?? null,
    realAge: latestAge?.chronological_age ?? null,
    achievableAge: latestAge?.fitness_age_achievable ?? null,
    factors: rankFactors(latestAge?.fitness_age_factors ?? null),
  };
}

// ---------- Race predictions ----------

export const RACES = [
  { key: "race_5k_s", label: "5K", miles: 3.10686 },
  { key: "race_10k_s", label: "10K", miles: 6.21371 },
  { key: "race_half_s", label: "Half marathon", miles: 13.10938 },
  { key: "race_marathon_s", label: "Marathon", miles: 26.21875 },
] as const;

export interface RacePrediction {
  label: string;
  /** The race's distance, for its pace per mile. */
  miles: number;
  points: DatedValue[];
  latest: number;
  /** Seconds, latest minus the range's first: negative is faster. */
  change: number | null;
}

export function buildRacePredictions(data: Pick<DashboardData, "training" | "dateRange" | "today">): RacePrediction[] {
  const rows = data.training.filter((r) => r.local_date <= data.today && isInRange(r.local_date, data.dateRange));
  return RACES.flatMap(({ key, label, miles }) => {
    const points = series(rows, (r) => r[key]);
    if (points.length === 0) return [];
    const latest = points[points.length - 1].value;
    return [{ label, miles, points, latest, change: points.length >= 2 ? latest - points[0].value : null }];
  });
}

/** A predicted finish time as a pace, in seconds per mile: a 29:13 5K is 9:24 a mile. */
export function racePaceSec(seconds: number, miles: number): number {
  return seconds / miles;
}

/** 1753 -> "29:13", 3837 -> "1:03:57". */
export function fmtRaceTime(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** -71 -> "▼ 1:11 faster", 30 -> "▲ 0:30 slower", 0 -> "● no change". */
export function fmtRaceChange(seconds: number): string {
  if (Math.round(seconds) === 0) return "● no change";
  return seconds < 0 ? `▼ ${fmtRaceTime(seconds)} faster` : `▲ ${fmtRaceTime(seconds)} slower`;
}
