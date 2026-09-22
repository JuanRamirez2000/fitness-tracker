import { describe, expect, it } from "vitest";
import { sevenDayAverage } from "./seven-day-average";
import { testDashboardData, trendRow, TODAY } from "./testing";

describe("sevenDayAverage", () => {
  it("is the empty state when today has no weigh-in", () => {
    expect(sevenDayAverage.compute(testDashboardData())).toBeNull();
  });

  it("shows the average and delta once warmed up (n7 >= 3)", () => {
    const data = testDashboardData({
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 230, avg7_lb: 230.8, n7: 5, avg7_delta_lb: -0.3 })],
    });
    const value = sevenDayAverage.compute(data)!;
    expect(value.sub).toBe("Smoothed line on the trend chart");
    expect(sevenDayAverage.format(value)).toEqual({ primary: "230.8", delta: "−0.3 lb", tone: "good" });
  });

  it("still shows a value while warming up, but drops the delta and says so", () => {
    const data = testDashboardData({
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 230, avg7_lb: 231, n7: 2, avg7_delta_lb: -0.5 })],
    });
    const value = sevenDayAverage.compute(data)!;
    expect(value.sub).toBe("Still warming up (2 of 3 days)");
    expect(sevenDayAverage.format(value).delta).toBeUndefined();
  });
});
