import { describe, expect, it } from "vitest";
import { progressToGoal } from "./progress-to-goal";
import { testDashboardData, testProfile, trendRow, TODAY } from "./testing";

describe("progressToGoal", () => {
  it("is the empty state with no goal set", () => {
    const data = testDashboardData({
      profile: testProfile({ goal_weight_lb: null }),
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 220, n7: 1 })],
      firstWeighIn: { user_id: "u", local_date: "2026-01-01", weight_lb: 232.4 },
    });
    expect(progressToGoal.compute(data)).toBeNull();
  });

  it("is the empty state when the start is already at or below the goal", () => {
    const data = testDashboardData({
      profile: testProfile({ goal_weight_lb: 200, start_weight_lb: 195 }),
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 190, n7: 1 })],
    });
    expect(progressToGoal.compute(data)).toBeNull();
  });

  it("is the empty state with no weigh-ins at all", () => {
    expect(progressToGoal.compute(testDashboardData({ profile: testProfile({ goal_weight_lb: 200 }) }))).toBeNull();
  });

  it("uses the profile's start override over the first weigh-in", () => {
    const data = testDashboardData({
      profile: testProfile({ goal_weight_lb: 200, start_weight_lb: 240 }),
      firstWeighIn: { user_id: "u", local_date: "2026-01-01", weight_lb: 232.4 },
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 220, n7: 1 })],
    });
    // (240 - 220) / (240 - 200) = 0.5
    expect(progressToGoal.compute(data)!.value).toBeCloseTo(50, 10);
  });

  it("falls back to the first weigh-in when there is no override", () => {
    const data = testDashboardData({
      profile: testProfile({ goal_weight_lb: 200 }),
      firstWeighIn: { user_id: "u", local_date: "2026-01-01", weight_lb: 232.4 },
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 216.2, n7: 1 })],
    });
    expect(progressToGoal.compute(data)!.value).toBeCloseTo(50, 5);
  });

  it("uses the 7-day average once warmed up, otherwise the latest raw weight", () => {
    const base = { profile: testProfile({ goal_weight_lb: 200, start_weight_lb: 240 }) };
    const warm = progressToGoal.compute(
      testDashboardData({ ...base, weightTrend: [trendRow({ local_date: TODAY, weight_lb: 220, avg7_lb: 222, n7: 5 })] }),
    )!;
    expect(warm.value).toBeCloseTo(((240 - 222) / 40) * 100, 5);

    const cold = progressToGoal.compute(
      testDashboardData({ ...base, weightTrend: [trendRow({ local_date: TODAY, weight_lb: 220, avg7_lb: 222, n7: 1 })] }),
    )!;
    expect(cold.value).toBeCloseTo(((240 - 220) / 40) * 100, 5);
  });

  it("clamps to 0..100% (overshooting the goal, or having gained since start)", () => {
    const base = testProfile({ goal_weight_lb: 200, start_weight_lb: 220 });
    const over = progressToGoal.compute(
      testDashboardData({ profile: base, weightTrend: [trendRow({ local_date: TODAY, weight_lb: 190, n7: 1 })] }),
    )!;
    expect(over.value).toBe(100);
    expect(over.progress).toBe(1);

    const behindStart = progressToGoal.compute(
      testDashboardData({ profile: base, weightTrend: [trendRow({ local_date: TODAY, weight_lb: 225, n7: 1 })] }),
    )!;
    expect(behindStart.value).toBe(0);
  });

  it("reports on-track vs behind pace only when a pace is set", () => {
    const withPace = testProfile({ goal_weight_lb: 200, start_weight_lb: 232, goal_pace_lb_per_week: 1 });
    // 2 weeks elapsed (programStart 09-17 + 14 days), expected = 232 - 2 = 230.
    const onTrack = progressToGoal.compute(
      testDashboardData({
        profile: withPace,
        today: "2026-10-01",
        weightTrend: [trendRow({ local_date: "2026-10-01", weight_lb: 229, n7: 1 })],
      }),
    )!;
    expect(onTrack.tone).toBe("good");
    expect(progressToGoal.format(onTrack).delta).toBe("on track");

    const behind = progressToGoal.compute(
      testDashboardData({
        profile: withPace,
        today: "2026-10-01",
        weightTrend: [trendRow({ local_date: "2026-10-01", weight_lb: 231, n7: 1 })],
      }),
    )!;
    expect(behind.tone).toBe("warn");
    expect(progressToGoal.format(behind).delta).toBe("behind pace");

    const noPace = progressToGoal.compute(
      testDashboardData({
        profile: testProfile({ goal_weight_lb: 200, start_weight_lb: 232 }),
        weightTrend: [trendRow({ local_date: TODAY, weight_lb: 229, n7: 1 })],
      }),
    )!;
    expect(noPace.tone).toBe("neutral");
    expect(progressToGoal.format(noPace).delta).toBeUndefined();
  });

  it("formats as a rounded percent", () => {
    const data = testDashboardData({
      profile: testProfile({ goal_weight_lb: 200, start_weight_lb: 232 }),
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 220, n7: 1 })],
    });
    // (232-220)/(232-200) = 37.5% -> rounds to 38%
    expect(progressToGoal.format(progressToGoal.compute(data)!).primary).toBe("38%");
  });
});
