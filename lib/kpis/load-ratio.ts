import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { ACWR_RANGE, trainingStatus } from "@/lib/charts/training";

const SPARKLINE_DAYS = 42;

/**
 * Garmin's acute:chronic load ratio and training status: a wide card whose sparkline shows six
 * weeks of the ratio over its healthy 0.8-1.5 band.
 */
export const loadRatio: KpiDefinition = {
  id: "load-ratio",
  label: "Load ratio · acute ÷ chronic",
  span: 2,
  bandLabel: "Healthy",
  visual: "sparkline",
  emptyMessage: "No training load from Garmin yet",
  compute(data: DashboardData): KpiValue | null {
    const days = data.training.filter((t) => t.local_date <= data.today && t.acwr !== null);
    const last = days.at(-1);
    if (!last || last.local_date < addDays(data.today, -3)) return null;
    const [low, high] = ACWR_RANGE;
    const status = trainingStatus(last.status);
    const inRange = last.acwr! >= low && last.acwr! <= high;
    return {
      value: last.acwr,
      unit: "",
      deltaText: status?.label ?? (inRange ? "healthy" : last.acwr! > high ? "high" : "low"),
      tone: !inRange ? "warn" : status?.tone === "good" ? "good" : "neutral",
      sub: `Acute ${Math.round(last.acute_load ?? 0)} · chronic ${Math.round(last.chronic_load ?? 0)} · healthy ${low}–${high}`,
      points: days
        .filter((t) => t.local_date > addDays(last.local_date, -SPARKLINE_DAYS))
        .map((t) => ({ date: t.local_date, value: t.acwr!, text: t.acwr!.toFixed(2), low, high })),
    };
  },
  format(v) {
    return { primary: v.value!.toFixed(1), delta: v.deltaText, tone: v.tone };
  },
};
