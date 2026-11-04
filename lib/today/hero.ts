import type { DashboardData } from "@/lib/dashboard/types";
import { READINESS_FACTOR_KEYS, type DailyRecovery, type ReadinessFactorKey, type SleepNight } from "@/lib/data/recovery";
import type { LocalDate } from "@/lib/dates/calendar";

/** The hero's factor rows, in display order. */
export const FACTOR_LABELS: Record<ReadinessFactorKey, string> = {
  sleep_history: "Sleep history",
  hrv: "HRV",
  recovery_time: "Recovery time",
  acwr: "Acute load ratio",
  stress_history: "Stress history",
  sleep: "Sleep",
};

export type FactorState = "good" | "fair" | "low";

/** The design's thresholds: Good >= 85, Fair 60 to 84, Low < 60. */
export function factorState(percent: number): FactorState {
  if (percent >= 85) return "good";
  if (percent >= 60) return "fair";
  return "low";
}

/** The glyph carries the state; color is secondary. */
export const FACTOR_GLYPH: Record<FactorState, string> = { good: "●", fair: "◐", low: "○" };
export const FACTOR_WORD: Record<FactorState, string> = { good: "Good", fair: "Fair", low: "Low" };

export type ReadinessBand = "good" | "warn" | "bad";

/** Garmin's readiness bands: 75+ high or prime, 50 to 74 moderate, below 50 low or poor. */
export function readinessBand(score: number): ReadinessBand {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

/** "MODERATE" -> "Moderate". */
export function titleCase(level: string): string {
  return level
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface HeroFactor {
  key: ReadinessFactorKey;
  label: string;
  percent: number;
  state: FactorState;
}

export interface TodayHero {
  readiness: {
    date: LocalDate;
    score: number;
    label: string;
    band: ReadinessBand;
    /** When Garmin computed this snapshot (ISO), for "as of 4:30 pm". */
    at: string | null;
    morningScore: number | null;
    factors: HeroFactor[];
    /** Recovery time left as of `at`. */
    recoveryHours: number | null;
  } | null;
  lastNight: {
    date: LocalDate;
    hours: number;
    score: number | null;
    needHours: number | null;
    /** Seconds per stage, in stack order (deep at the bottom / left). */
    stages: { deep: number; rem: number; light: number; awake: number };
  } | null;
  batteryWake: { date: LocalDate; value: number } | null;
  today: LocalDate;
}

/** The latest row on or before `today` for which `has` is true. Rows are oldest first. */
function latestWith<T extends { local_date: LocalDate }>(rows: T[], today: LocalDate, has: (row: T) => boolean): T | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].local_date <= today && has(rows[i])) return rows[i];
  }
  return null;
}

/**
 * Everything the Today hero shows, each part from the latest day that has it (so the hero
 * still says something before this morning's data has synced; the component labels a part
 * whose date isn't today). Garmin owns every value here; nothing is computed.
 */
export function buildTodayHero(data: Pick<DashboardData, "recovery" | "sleep" | "today">): TodayHero {
  const { today } = data;
  const r = latestWith<DailyRecovery>(data.recovery, today, (row) => row.readiness_score !== null);
  const night = latestWith<SleepNight>(data.sleep, today, (row) => (row.duration_s ?? 0) > 0);
  const wake = latestWith<DailyRecovery>(data.recovery, today, (row) => row.body_battery_wake !== null);

  return {
    today,
    readiness:
      r && r.readiness_score !== null
        ? {
            date: r.local_date,
            score: r.readiness_score,
            label: r.readiness_level ? titleCase(r.readiness_level) : "",
            band: readinessBand(r.readiness_score),
            at: r.readiness_at,
            morningScore: r.readiness_morning_score,
            recoveryHours: r.recovery_hours,
            factors: READINESS_FACTOR_KEYS.flatMap((key) => {
              const percent = r.readiness_factors?.[key];
              return percent == null ? [] : [{ key, label: FACTOR_LABELS[key], percent, state: factorState(percent) }];
            }),
          }
        : null,
    lastNight: night
      ? {
          date: night.local_date,
          hours: (night.duration_s ?? 0) / 3600,
          score: night.score,
          needHours: night.need_s === null ? null : night.need_s / 3600,
          stages: {
            deep: night.deep_s ?? 0,
            rem: night.rem_s ?? 0,
            light: night.light_s ?? 0,
            awake: night.awake_s ?? 0,
          },
        }
      : null,
    batteryWake: wake && wake.body_battery_wake !== null ? { date: wake.local_date, value: wake.body_battery_wake } : null,
  };
}
