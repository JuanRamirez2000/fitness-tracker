import { describe, expect, it } from "vitest";
import { testDashboardData, testProfile, trendRow } from "@/lib/kpis/testing";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { buildWeightTrend } from "./weight-trend";

describe("buildWeightTrend", () => {
  it("is null with no weigh-ins in the selected range", () => {
    expect(buildWeightTrend(testDashboardData())).toBeNull();
  });

  it("maps rows in the date range to points, dropping ones outside it", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-15", to: "2026-09-20" },
      weightTrend: [
        trendRow({ local_date: "2026-09-10", weight_lb: 235, avg7_lb: 235 }), // outside
        trendRow({ local_date: "2026-09-16", weight_lb: 232, avg7_lb: 233 }),
        trendRow({ local_date: "2026-09-20", weight_lb: 229, avg7_lb: 230 }),
      ],
    });
    const chart = buildWeightTrend(data)!;
    expect(chart.points.map((p) => p.local_date)).toEqual(["2026-09-16", "2026-09-20"]);
    expect(chart.points[0].dateMs).toBe(dayStartUtcMs("2026-09-16"));
  });

  it("only extends the y-domain to include the goal on a long-enough range", () => {
    const rows = [trendRow({ local_date: "2026-09-20", weight_lb: 210, avg7_lb: 210 })];
    const shortRange = buildWeightTrend(
      testDashboardData({
        dateRange: { key: "week", from: "2026-09-14", to: "2026-09-20" },
        weightTrend: rows,
        profile: testProfile({ goal_weight_lb: 180 }),
      }),
    )!;
    expect(shortRange.yDomain[0]).toBeGreaterThan(180); // goal is NOT pulled into a 7-day domain

    const longRange = buildWeightTrend(
      testDashboardData({
        dateRange: { key: "all", from: "2026-01-01", to: "2026-09-20" },
        weightTrend: rows,
        profile: testProfile({ goal_weight_lb: 180 }),
      }),
    )!;
    expect(longRange.yDomain[0]).toBeLessThanOrEqual(180); // a year view does pull it in
  });

  it("builds a pace line only when both a goal and a pace are set", () => {
    const rows = [trendRow({ local_date: "2026-09-20", weight_lb: 210, avg7_lb: 210 })];
    const withoutPace = buildWeightTrend(
      testDashboardData({ dateRange: { key: "all", from: "2026-01-01", to: "2026-09-20" }, weightTrend: rows }),
    )!;
    expect(withoutPace.paceLine).toBeNull();

    const withPace = buildWeightTrend(
      testDashboardData({
        dateRange: { key: "all", from: "2026-01-01", to: "2026-09-20" },
        weightTrend: rows,
        profile: testProfile({ goal_weight_lb: 200, goal_pace_lb_per_week: 1, start_weight_lb: 220 }),
      }),
    )!;
    expect(withPace.paceLine).not.toBeNull();
    expect(withPace.paceLine!.start.weight).toBe(220);
  });

  it("only reports programStartMs when the program start falls inside the range", () => {
    const rows = [trendRow({ local_date: "2026-09-20", weight_lb: 210, avg7_lb: 210 })];
    const outside = buildWeightTrend(
      testDashboardData({ dateRange: { key: "week", from: "2026-09-19", to: "2026-09-20" }, weightTrend: rows }),
    )!;
    expect(outside.programStartMs).toBeNull(); // programStart 2026-09-17 (fixture default) is before the range

    const inside = buildWeightTrend(
      testDashboardData({ dateRange: { key: "all", from: "2026-01-01", to: "2026-09-20" }, weightTrend: rows }),
    )!;
    expect(inside.programStartMs).not.toBeNull();
  });
});
