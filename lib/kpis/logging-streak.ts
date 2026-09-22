import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";

export const loggingStreak: KpiDefinition = {
  id: "logging-streak",
  label: "Logging streak",
  compute(data: DashboardData): KpiValue | null {
    const logged = new Set(data.weightTrend.map((row) => row.local_date));
    let streak = 0;
    for (let date = data.today; date >= data.programStart; date = addDays(date, -1)) {
      if (!logged.has(date)) break;
      streak++;
    }
    return {
      value: streak,
      unit: streak === 1 ? "day" : "days",
      tone: "neutral",
      sub: "Consecutive weigh-ins",
    };
  },
  format(v) {
    return { primary: String(v.value), tone: v.tone };
  },
};
