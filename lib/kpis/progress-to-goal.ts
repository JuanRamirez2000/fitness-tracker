import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { MIN_AVG7_SAMPLES } from "@/lib/data/weight-trend";
import { diffDays } from "@/lib/dates/calendar";
import { clamp } from "./format";

export const progressToGoal: KpiDefinition = {
  id: "progress-to-goal",
  label: "Progress to goal",
  visual: "progress",
  emptyMessage: "Set a goal",
  compute(data: DashboardData): KpiValue | null {
    const latest = data.weightTrend.at(-1);
    const start = data.profile.start_weight_lb ?? data.firstWeighIn?.weight_lb ?? null;
    const goal = data.profile.goal_weight_lb;

    if (!latest || start === null || goal === null || start <= goal) return null;

    const current = latest.n7 >= MIN_AVG7_SAMPLES ? latest.avg7_lb : latest.weight_lb;
    const pct = clamp((start - current) / (start - goal), 0, 1);
    const remainingLb = Math.max(0, current - goal);
    const totalLb = start - goal;

    // Only drawn/compared when a pace is set (brief); without one there is no on-track line.
    let onTrack: boolean | undefined;
    if (data.profile.goal_pace_lb_per_week !== null) {
      const weeksElapsed = diffDays(latest.local_date, data.programStart) / 7;
      const expected = start - weeksElapsed * data.profile.goal_pace_lb_per_week;
      onTrack = current <= expected;
    }

    return {
      value: pct * 100,
      unit: "%",
      tone: onTrack === undefined ? "neutral" : onTrack ? "good" : "warn",
      sub: `${remainingLb.toFixed(1)} lb to go · ${totalLb.toFixed(1)} lb total`,
      deltaText: onTrack === undefined ? undefined : onTrack ? "on track" : "behind pace",
      progress: pct,
    };
  },
  format(v) {
    return { primary: `${Math.round(v.value!)}%`, delta: v.deltaText, tone: v.tone };
  },
};
