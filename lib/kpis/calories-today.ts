import type { DashboardData, KpiDefinition, KpiTone, KpiValue } from "@/lib/dashboard/types";
import type { TrackingStatus } from "@/lib/data/nutrition-days";

const STATUS_LABEL: Record<TrackingStatus, string> = {
  accurate: "Accurate",
  uncertain: "May be off",
  missed: "Missed",
};
const STATUS_TONE: Record<TrackingStatus, KpiTone> = {
  accurate: "good",
  uncertain: "warn",
  missed: "bad",
};

export const caloriesToday: KpiDefinition = {
  id: "calories-today",
  label: "Calories today",
  emptyMessage: "Not logged yet",
  compute(data: DashboardData): KpiValue | null {
    // The heatmap's own window always spans through today's week, so it already has
    // whatever nutrition_days row exists for today; no extra fetch needed.
    const today = data.heatmap.nutritionDays.find((row) => row.local_date === data.today);
    if (!today) return null;

    return {
      value: today.calories_kcal, // reserved for V1; V0 always shows "—" (see format)
      unit: "kcal",
      tone: STATUS_TONE[today.tracking_status],
      deltaText: STATUS_LABEL[today.tracking_status],
      sub: "Status only until totals are logged",
    };
  },
  format(v) {
    return { primary: v.value !== null ? String(v.value) : "—", delta: v.deltaText, tone: v.tone };
  },
};
