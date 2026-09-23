import { describe, expect, it } from "vitest";
import { testDashboardData, testProfile } from "@/lib/kpis/testing";
import type { DailyMetric } from "@/lib/data/daily-metrics";
import { buildSteps } from "./steps";

function stepRow(local_date: string, value: number): DailyMetric {
  return { user_id: "u", local_date, metric: "steps", value, source: "manual", updated_at: "2026-09-20T00:00:00Z" };
}

describe("buildSteps", () => {
  it("gives one bar per day, defaulting a missing day to zero, under the aggregate threshold", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-16" },
      profile: testProfile({ steps_goal: 10000 }),
      range: { window: { from: "2026-09-14", to: "2026-09-16" }, nutritionDays: [], activities: [], steps: [stepRow("2026-09-14", 12000)] },
    });
    const chart = buildSteps(data);
    expect(chart.aggregated).toBe(false);
    expect(chart.bars).toEqual([
      { label: "2026-09-14", steps: 12000, hitGoal: true },
      { label: "2026-09-15", steps: 0, hitGoal: false },
      { label: "2026-09-16", steps: 0, hitGoal: false },
    ]);
    expect(chart.hitCount).toBe(1);
  });

  it("switches to a weekly average past the aggregate threshold", () => {
    const data = testDashboardData({
      dateRange: { key: "year", from: "2026-01-01", to: "2026-09-20" }, // > 45 days
      profile: testProfile({ steps_goal: 10000 }),
    });
    expect(buildSteps(data).aggregated).toBe(true);
  });

  it("compares against the account's real steps_goal, not a hardcoded 10k", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-14" },
      profile: testProfile({ steps_goal: 6000 }),
      range: { window: { from: "2026-09-14", to: "2026-09-14" }, nutritionDays: [], activities: [], steps: [stepRow("2026-09-14", 7000)] },
    });
    const chart = buildSteps(data);
    expect(chart.goal).toBe(6000);
    expect(chart.bars[0].hitGoal).toBe(true); // 7000 >= 6000, even though it's under the design's fixed 10k
  });
});
