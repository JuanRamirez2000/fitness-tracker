import type { DashboardData } from "@/lib/dashboard/types";
import { READINESS_FACTOR_KEYS, type ReadinessFactorKey } from "@/lib/data/recovery";
import type { LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";

export interface ReadinessDay {
  date: LocalDate;
  /** The score at wake (what the day started with), or the day's latest when there's none. */
  score: number;
  /** Each factor's percent that morning; null where Garmin gave none. */
  factors: Record<ReadinessFactorKey, number | null>;
}

export interface ReadinessTrend {
  days: ReadinessDay[];
  average: number;
  latest: ReadinessDay;
  /** Days below 50 (Garmin's low and poor), and 75 or more (high and prime). */
  lowDays: number;
  highDays: number;
  /** The factor most often below "fair" (under 60) in the range, if any was. */
  weakest: { key: ReadinessFactorKey; lowDays: number } | null;
}

/** Each morning's training readiness in the range, with the factors behind it. Pure. */
export function buildReadinessTrend(data: Pick<DashboardData, "recovery" | "dateRange" | "today">): ReadinessTrend | null {
  const days: ReadinessDay[] = data.recovery
    .filter((r) => r.local_date <= data.today && isInRange(r.local_date, data.dateRange))
    .flatMap((r) => {
      const score = r.readiness_morning_score ?? r.readiness_score;
      if (score === null) return [];
      const factors = Object.fromEntries(READINESS_FACTOR_KEYS.map((k) => [k, r.readiness_factors?.[k] ?? null])) as ReadinessDay["factors"];
      return [{ date: r.local_date, score, factors }];
    });
  if (!days.length) return null;

  const lowCounts = READINESS_FACTOR_KEYS.map((key) => ({ key, lowDays: days.filter((d) => d.factors[key] !== null && d.factors[key]! < 60).length }));
  const weakest = lowCounts.sort((a, b) => b.lowDays - a.lowDays)[0];
  return {
    days,
    average: days.reduce((s, d) => s + d.score, 0) / days.length,
    latest: days[days.length - 1],
    lowDays: days.filter((d) => d.score < 50).length,
    highDays: days.filter((d) => d.score >= 75).length,
    weakest: weakest.lowDays > 0 ? weakest : null,
  };
}
