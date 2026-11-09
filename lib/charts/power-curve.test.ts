import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun, trendRow } from "@/lib/kpis/testing";
import { buildPowerCurve, fmtDurationShort } from "./power-curve";

const SEPTEMBER = { key: "custom" as const, from: "2026-09-01", to: "2026-09-20" };

describe("buildPowerCurve", () => {
  const old = testRide({ local_date: "2026-08-10", power_curve: { "5": 500, "60": 300, "1200": 200 } });
  const recent = testRide({ local_date: "2026-09-15", power_curve: { "5": 450, "60": 320, "300": 240, "1200": 190 } });

  it("keeps the best watts at each duration, in range and all time, with the ride that set it", () => {
    const curve = buildPowerCurve(testDashboardData({ dateRange: SEPTEMBER, activities: [old, recent, testRun({ local_date: "2026-09-16" })] }))!;
    expect(curve.points.map((p) => p.seconds)).toEqual([5, 60, 300, 1200]);
    const five = curve.points[0];
    expect(five.allTime).toMatchObject({ watts: 500, date: "2026-08-10" });
    expect(five.inRange).toMatchObject({ watts: 450, date: "2026-09-15", activityId: recent.id });
    expect(curve.points[1].allTime.watts).toBe(320);
    expect(curve.rides).toBe(2);
  });

  it("lists record rows only for the durations ridden, and reads weight for W/kg", () => {
    const curve = buildPowerCurve(
      testDashboardData({ dateRange: SEPTEMBER, activities: [recent], weightTrend: [trendRow({ local_date: "2026-09-19", weight_lb: 220.462 })] }),
    )!;
    expect(curve.records.map((r) => r.seconds)).toEqual([5, 60, 300, 1200]);
    expect(curve.weightKg).toBeCloseTo(100, 3);
  });

  it("has nothing in range when no ride with power falls in it", () => {
    const curve = buildPowerCurve(testDashboardData({ dateRange: SEPTEMBER, activities: [old] }))!;
    expect(curve.points.every((p) => p.inRange === null)).toBe(true);
  });

  it("is null without power", () => {
    expect(buildPowerCurve(testDashboardData({ activities: [testRide({ local_date: "2026-09-15", power_curve: null })] }))).toBeNull();
  });
});

describe("fmtDurationShort", () => {
  it("reads like a coach would say it", () => {
    expect([5, 60, 300, 1200, 3600].map(fmtDurationShort)).toEqual(["5 s", "1 min", "5 min", "20 min", "1 h"]);
  });
});
