import { describe, expect, it } from "vitest";
import { testDashboardData, testProfile, trendRow } from "@/lib/kpis/testing";
import { buildProgress } from "./progress";

describe("buildProgress", () => {
  it("is null with no weigh-ins or no known start weight", () => {
    expect(buildProgress(testDashboardData())).toBeNull();
  });

  it("computes the signed change since the start weight, using the WHOLE history regardless of dateRange", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-19", to: "2026-09-20" }, // narrow range
      profile: testProfile({ start_weight_lb: 220 }),
      weightTrend: [
        trendRow({ local_date: "2026-09-01", weight_lb: 220, avg7_lb: 220 }),
        trendRow({ local_date: "2026-09-19", weight_lb: 215, avg7_lb: 216 }),
        trendRow({ local_date: "2026-09-20", weight_lb: 213, avg7_lb: 214 }),
      ],
    });
    const progress = buildProgress(data)!;
    expect(progress.changedLb).toBe(213 - 220);
    expect(progress.startLb).toBe(220);
    // The series spans every recorded row, not just the ones inside the narrow dateRange.
    expect(progress.series).toHaveLength(3);
    expect(progress.series[0]).toEqual({ local_date: "2026-09-01", changeLb: 0 });
  });

  it("reuses progress-to-goal's own percentage rather than deriving a second one", () => {
    const data = testDashboardData({
      profile: testProfile({ start_weight_lb: 220, goal_weight_lb: 200 }),
      weightTrend: [trendRow({ local_date: "2026-09-20", weight_lb: 210, avg7_lb: 210, n7: 7 })],
    });
    const progress = buildProgress(data)!;
    expect(progress.pct).toBeCloseTo(0.5, 10); // halfway from 220 to 200
    expect(progress.remainingLb).toBe(10);
  });

  it("has a null pct and remainingLb with no goal set", () => {
    const data = testDashboardData({
      profile: testProfile({ start_weight_lb: 220 }),
      weightTrend: [trendRow({ local_date: "2026-09-20", weight_lb: 210, avg7_lb: 210 })],
    });
    const progress = buildProgress(data)!;
    expect(progress.pct).toBeNull();
    expect(progress.remainingLb).toBeNull();
  });
});
