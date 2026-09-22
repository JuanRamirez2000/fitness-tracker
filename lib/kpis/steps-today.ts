import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { clamp } from "./format";

export const stepsToday: KpiDefinition = {
  id: "steps-today",
  label: "Steps today",
  visual: "progress",
  emptyMessage: "Not logged yet",
  compute(data: DashboardData): KpiValue | null {
    const today = data.heatmap.steps.find((row) => row.local_date === data.today);
    if (!today) return null;

    const goal = data.profile.steps_goal;
    const hit = today.value >= goal;
    return {
      value: today.value,
      unit: "",
      tone: hit ? "good" : "neutral",
      deltaText: hit ? `${(goal / 1000).toFixed(0)}k hit` : "under",
      sub: `Goal ${goal.toLocaleString()}`,
      progress: clamp(today.value / goal, 0, 1),
    };
  },
  format(v) {
    return { primary: `${(v.value! / 1000).toFixed(1)}k`, delta: v.deltaText, tone: v.tone };
  },
};
