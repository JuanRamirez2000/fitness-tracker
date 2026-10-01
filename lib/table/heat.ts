import type { WeightTrendRow } from "@/lib/data/weight-trend";
import type { LocalDate } from "@/lib/dates/calendar";
import { weightCell, type WeightMode } from "@/lib/heatmap/weight-rules";
import type { Palette } from "@/lib/theme/palette";

export interface HeatValue {
  /** The day's change vs the previous recorded day; null for the first ever weigh-in. */
  deltaLb: number | null;
  /** Same color scale as the heatmap; null when there is nothing to color (warming up). */
  fill: string | null;
}

export interface DayHeat {
  raw: HeatValue;
  avg7: HeatValue & { avg7Lb: number; warmingUp: boolean };
}

/**
 * Per-day colors for the weigh-ins table, from the same weight_trend rows and color rules the
 * heatmap uses, so a table row and its heatmap cell always agree. `trend` must be the whole
 * history in ascending order (DashboardData.weightTrend): each day is compared with the
 * previous RECORDED day, which may fall outside the table's range.
 */
export function dayHeat(trend: readonly WeightTrendRow[], palette: Palette): Map<LocalDate, DayHeat> {
  const byDate = new Map<LocalDate, DayHeat>();
  let previous: WeightTrendRow | null = null;
  for (const row of trend) {
    const cell = (mode: WeightMode) => weightCell(mode, row, previous, palette);
    const avg7 = cell("avg7");
    byDate.set(row.local_date, {
      raw: { deltaLb: row.raw_delta_lb, fill: cell("raw").fill },
      avg7: {
        deltaLb: row.avg7_delta_lb,
        avg7Lb: row.avg7_lb,
        warmingUp: avg7.state === "warming_up",
        fill: avg7.state === "warming_up" ? null : avg7.fill,
      },
    });
    previous = row;
  }
  return byDate;
}
