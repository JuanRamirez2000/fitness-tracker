import type { DashboardData } from "@/lib/dashboard/types";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { isEasyRun, median, runsIn } from "@/lib/running/runs";
import { isRide } from "@/lib/sport";

/** Like the run chart's trend: the median of each ride and the ones before it. */
const TREND_RIDES = 5;
/** Shorter rides (a spin to the shop) are too noisy to judge efficiency by. */
const MIN_EFFICIENCY_S = 15 * 60;

export interface RideEfficiencyPoint {
  id: string;
  name: string;
  dateMs: number;
  local_date: string;
  /** Average watts per average heartbeat. */
  wattsPerBeat: number;
  watts: number;
  avgHr: number;
  indoor: boolean;
  /** The rolling median. */
  trend: number;
}

export interface RideEfficiencyData {
  points: RideEfficiencyPoint[];
  domain: [number, number];
  /** Last trend value against the first, percent: positive means more watts for the same heart rate. */
  changePct: number | null;
}

/**
 * Each easy ride's average power per average heartbeat (Garmin's recovery or aerobic-base
 * label, with power, heart rate and at least 15 minutes). Power doesn't care about terrain,
 * wind or a trainer's made-up speed, so indoor and outdoor rides compare directly: a line
 * that climbs is more watts for the same heart rate. Pure, unit-tested.
 */
export function buildRideEfficiency(data: Pick<DashboardData, "activities" | "dateRange">): RideEfficiencyData | null {
  const scored = data.activities
    .filter(
      (a) =>
        isRide(a) &&
        isEasyRun(a) &&
        a.local_date <= data.dateRange.to &&
        a.avg_power_w &&
        a.avg_hr &&
        (a.moving_duration_s ?? a.duration_s) >= MIN_EFFICIENCY_S,
    )
    .map((a) => ({ ride: a, value: a.avg_power_w! / a.avg_hr! }));
  const inRange = new Set(runsIn(scored.map((s) => s.ride), data.dateRange).map((r) => r.id));

  const points: RideEfficiencyPoint[] = [];
  scored.forEach((s, i) => {
    if (!inRange.has(s.ride.id)) return;
    points.push({
      id: s.ride.id,
      name: s.ride.name ?? "Ride",
      dateMs: dayStartUtcMs(s.ride.local_date),
      local_date: s.ride.local_date,
      wattsPerBeat: s.value,
      watts: s.ride.avg_power_w!,
      avgHr: s.ride.avg_hr!,
      indoor: s.ride.activity_type === "indoor_cycling" || s.ride.activity_type === "virtual_ride",
      trend: median(scored.slice(Math.max(0, i - TREND_RIDES + 1), i + 1).map((w) => w.value))!,
    });
  });
  if (!points.length) return null;

  const values = points.flatMap((p) => [p.wattsPerBeat, p.trend]);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 0.05);
  const first = points[0].trend;
  return {
    points,
    domain: [Math.min(...values) - pad, Math.max(...values) + pad],
    changePct: points.length >= 2 ? ((points.at(-1)!.trend - first) / first) * 100 : null,
  };
}
