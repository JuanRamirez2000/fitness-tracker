import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { climbGainPct } from "@/lib/insights/weight";

/**
 * What the weight lost so far is worth on a climb: percent faster at the same power than at the
 * start weight (the Weight tab's bike-side card in place of body fat). Rider plus an assumed
 * bike-and-gear weight; time up a steady climb scales with total weight.
 */
export const climbGain: KpiDefinition = {
  id: "climb-gain",
  label: "Climbing, same power",
  visual: "sparkline",
  emptyMessage: "Needs a start weight and a weigh-in",
  compute(data: DashboardData): KpiValue | null {
    const rows = data.weightTrend.filter((r) => r.local_date <= data.today);
    const last = rows.at(-1);
    const start = data.profile.start_weight_lb ?? rows[0]?.weight_lb ?? null;
    if (!last || start === null) return null;
    const pct = climbGainPct(start, last.avg7_lb);
    return {
      value: pct,
      unit: "%",
      tone: pct > 0 ? "good" : "neutral",
      sub: `Faster up a climb than at ${Math.round(start)} lb · next 10 lb ≈ +${Math.round(climbGainPct(last.avg7_lb, last.avg7_lb - 10))}%`,
      points: rows.slice(-60).map((r) => ({ date: r.local_date, value: climbGainPct(start, r.avg7_lb), text: `${climbGainPct(start, r.avg7_lb).toFixed(1)}% faster` })),
    };
  },
  format(v) {
    return { primary: `${v.value! >= 0 ? "+" : ""}${v.value!.toFixed(1)}`, tone: v.tone };
  },
};
