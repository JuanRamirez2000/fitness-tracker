import { describe, expect, it } from "vitest";
import { testDashboardData, trendRow, TODAY } from "./testing";
import { weeklyRate } from "./weekly-rate";

describe("weeklyRate", () => {
  it("is the empty state with no weigh-ins at all", () => {
    expect(weeklyRate.compute(testDashboardData())).toBeNull();
  });

  it("is the empty state (warming up) with fewer than 7 elapsed program days", () => {
    // programStart 2026-09-17, latest 2026-09-20 is only 4 elapsed days.
    const data = testDashboardData({
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 230, avg7_lb: 230 })],
    });
    expect(weeklyRate.compute(data)).toBeNull();
  });

  it("compares the latest 7-day average to the nearest one from 7 days earlier", () => {
    const data = testDashboardData({
      programStart: "2026-09-01",
      today: "2026-09-20",
      weightTrend: [
        trendRow({ local_date: "2026-09-12", weight_lb: 232, avg7_lb: 232 }), // nearest to 09-13
        trendRow({ local_date: "2026-09-20", weight_lb: 229, avg7_lb: 229.5 }),
      ],
    });
    const value = weeklyRate.compute(data)!;
    expect(value.value).toBeCloseTo(229.5 - 232, 10);
    expect(value.unit).toBe("lb/wk");
    expect(value.tone).toBe("good"); // losing
  });

  it("picks the day-7-earlier's exact row when one exists, over a nearby one", () => {
    const data = testDashboardData({
      programStart: "2026-09-01",
      today: "2026-09-20",
      weightTrend: [
        trendRow({ local_date: "2026-09-12", weight_lb: 235, avg7_lb: 235 }),
        trendRow({ local_date: "2026-09-13", weight_lb: 232, avg7_lb: 232 }), // exact -7d match
        trendRow({ local_date: "2026-09-20", weight_lb: 229, avg7_lb: 229 }),
      ],
    });
    expect(weeklyRate.compute(data)!.value).toBe(229 - 232);
  });

  it("is neutral, not bad, for a gaining week", () => {
    const data = testDashboardData({
      programStart: "2026-09-01",
      today: "2026-09-20",
      weightTrend: [
        trendRow({ local_date: "2026-09-13", weight_lb: 229, avg7_lb: 229 }),
        trendRow({ local_date: "2026-09-20", weight_lb: 231, avg7_lb: 231 }),
      ],
    });
    expect(weeklyRate.compute(data)!.tone).toBe("neutral");
  });

  it("formats with a real minus sign and one decimal", () => {
    const data = testDashboardData({
      programStart: "2026-09-01",
      today: "2026-09-20",
      weightTrend: [
        trendRow({ local_date: "2026-09-13", weight_lb: 232, avg7_lb: 232 }),
        trendRow({ local_date: "2026-09-20", weight_lb: 229.5, avg7_lb: 229.5 }),
      ],
    });
    expect(weeklyRate.format(weeklyRate.compute(data)!)).toEqual({ primary: "−2.5", tone: "good" });
  });
});
