import type { DashboardData } from "@/lib/dashboard/types";
import { isInRange } from "@/lib/heatmap/cell-state";
import { isRide } from "@/lib/sport";

/** The durations with their own record row under the curve, in seconds. */
export const RECORD_DURATIONS = [5, 60, 300, 1200, 3600] as const;
const LB_PER_KG = 2.20462;

export interface PowerBest {
  watts: number;
  activityId: string;
  date: string;
  name: string;
}

export interface PowerCurvePoint {
  seconds: number;
  /** The best average power for this long in the selected range, and ever. */
  inRange: PowerBest | null;
  allTime: PowerBest;
}

export interface PowerCurve {
  points: PowerCurvePoint[];
  /** The rows under the curve: RECORD_DURATIONS that any ride has reached. */
  records: PowerCurvePoint[];
  /** The latest weigh-in's 7-day average, in kg, for watts per kilo. */
  weightKg: number | null;
  rides: number;
}

/** "5 s", "1 min", "20 min", "1 h". */
export function fmtDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${seconds / 60} min`;
  return `${seconds / 3600} h`;
}

/**
 * Best average power at every duration Garmin reports (its maxAvgPower_N per ride, stored as
 * activities.power_curve), in the selected range against all time. Null without any ride with
 * power. Pure, unit-tested.
 */
export function buildPowerCurve(data: Pick<DashboardData, "activities" | "dateRange" | "today" | "weightTrend">): PowerCurve | null {
  const rides = data.activities.filter((a) => isRide(a) && a.power_curve && a.local_date <= data.today);
  if (!rides.length) return null;

  const best = new Map<number, { inRange: PowerBest | null; allTime: PowerBest }>();
  for (const r of rides) {
    const inRange = isInRange(r.local_date, data.dateRange);
    for (const [key, watts] of Object.entries(r.power_curve!)) {
      const seconds = Number(key);
      const mark: PowerBest = { watts, activityId: r.id, date: r.local_date, name: r.name ?? "Ride" };
      const cur = best.get(seconds);
      if (!cur) best.set(seconds, { allTime: mark, inRange: inRange ? mark : null });
      else {
        if (watts > cur.allTime.watts) cur.allTime = mark;
        if (inRange && (!cur.inRange || watts > cur.inRange.watts)) cur.inRange = mark;
      }
    }
  }

  const points = [...best.entries()].sort(([a], [b]) => a - b).map(([seconds, b]) => ({ seconds, ...b }));
  const weigh = [...data.weightTrend].reverse().find((w) => w.local_date <= data.today);
  return {
    points,
    records: points.filter((p) => (RECORD_DURATIONS as readonly number[]).includes(p.seconds)),
    weightKg: weigh ? (weigh.avg7_lb ?? weigh.weight_lb) / LB_PER_KG : null,
    rides: rides.length,
  };
}
