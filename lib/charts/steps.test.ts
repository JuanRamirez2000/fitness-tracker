import { describe, expect, it } from "vitest";
import type { DailySteps } from "@/lib/data/steps";
import { testDashboardData } from "@/lib/kpis/testing";
import { buildSteps } from "./steps";

function stepRow(local_date: string, steps: number): DailySteps {
  return { user_id: "u", local_date, steps, source: "garmin", updated_at: "2026-09-20T00:00:00Z" };
}

describe("buildSteps", () => {
  it("gives one bar per day, defaulting a missing day to zero, under the aggregate threshold", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-16" },
      steps: [stepRow("2026-09-14", 12000), stepRow("2026-09-16", 9999)],
    });
    const chart = buildSteps(data);
    expect(chart.aggregated).toBe(false);
    expect(chart.bars).toEqual([
      { label: "2026-09-14", steps: 12000, hitGoal: true },
      { label: "2026-09-15", steps: 0, hitGoal: false },
      { label: "2026-09-16", steps: 9999, hitGoal: false },
    ]);
    expect(chart.hitCount).toBe(1);
  });

  it("counts exactly 10,000 steps as hitting the goal", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-14" },
      steps: [stepRow("2026-09-14", 10000)],
    });
    expect(buildSteps(data).bars[0].hitGoal).toBe(true);
  });

  it("switches to weekly averages past the aggregate threshold, still counting hit days per day", () => {
    const data = testDashboardData({
      dateRange: { key: "6m", from: "2026-01-01", to: "2026-03-31" },
      steps: [stepRow("2026-01-05", 20000), stepRow("2026-01-06", 20000)],
    });
    const chart = buildSteps(data);
    expect(chart.aggregated).toBe(true);
    expect(chart.hitCount).toBe(2);
    expect(chart.bars.every((b) => b.label >= "2026-01-01")).toBe(true);
  });
});
