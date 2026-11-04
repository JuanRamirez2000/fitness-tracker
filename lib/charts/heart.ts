import type { DashboardData } from "@/lib/dashboard/types";
import type { LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";

export interface RestingHrPoint {
  date: LocalDate;
  value: number;
}

export interface HrvPoint {
  date: LocalDate;
  value: number;
  /** Garmin's balanced range for that day, when it has one. */
  low: number | null;
  high: number | null;
  /** Inside the band (or no band to judge against). Outside points are drawn as squares. */
  inBand: boolean;
}

export interface HeartChartData {
  /** The first day with any data in the range: the x axis starts here, so a range reaching
   * back before the watch's history isn't mostly empty. */
  dataFrom: LocalDate;
  restingHr: RestingHrPoint[];
  hrv: HrvPoint[];
  /** Latest value and its change since the range's first value. */
  rhrLatest: number | null;
  rhrDelta: number | null;
  hrvLatest: HrvPoint | null;
  hrvDelta: number | null;
  hrvOutOfBand: number;
}

const deltaOf = (points: { value: number }[]) => (points.length >= 2 ? points[points.length - 1].value - points[0].value : null);

/** Resting HR and overnight HRV inside the range, with HRV judged against its own band. */
export function buildHeartChart(data: Pick<DashboardData, "recovery" | "dateRange">): HeartChartData | null {
  const rows = data.recovery.filter((r) => isInRange(r.local_date, data.dateRange));
  const restingHr = rows.flatMap((r) => (r.resting_hr === null ? [] : [{ date: r.local_date, value: r.resting_hr }]));
  const hrv = rows.flatMap((r): HrvPoint[] => {
    if (r.hrv_ms === null) return [];
    const { hrv_baseline_low: low, hrv_baseline_high: high } = r;
    const inBand = low === null || high === null || (r.hrv_ms >= low && r.hrv_ms <= high);
    return [{ date: r.local_date, value: r.hrv_ms, low, high, inBand }];
  });
  if (restingHr.length === 0 && hrv.length === 0) return null;

  return {
    dataFrom: [restingHr[0]?.date, hrv[0]?.date].filter(Boolean).sort()[0] as LocalDate,
    restingHr,
    hrv,
    rhrLatest: restingHr.at(-1)?.value ?? null,
    rhrDelta: deltaOf(restingHr),
    hrvLatest: hrv.at(-1) ?? null,
    hrvDelta: deltaOf(hrv),
    hrvOutOfBand: hrv.filter((p) => !p.inBand).length,
  };
}
