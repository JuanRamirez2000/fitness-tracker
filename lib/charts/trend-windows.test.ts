import { describe, expect, it } from "vitest";
import { testDashboardData, trendRow } from "@/lib/kpis/testing";
import { buildTrendWindows } from "./trend-windows";

describe("buildTrendWindows", () => {
  it("windows the same trend rows to the last month, 6 months and year, ignoring dateRange", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-20" },
      weightTrend: [
        trendRow({ local_date: "2025-12-01", weight_lb: 250, avg7_lb: 250 }), // year only
        trendRow({ local_date: "2026-05-01", weight_lb: 240, avg7_lb: 240 }), // 6m and year
        trendRow({ local_date: "2026-09-01", weight_lb: 232, avg7_lb: 233 }), // all three
        trendRow({ local_date: "2026-09-20", weight_lb: 229, avg7_lb: 230 }),
      ],
    });
    const [month, sixMonths, year] = buildTrendWindows(data);
    expect([month.key, sixMonths.key, year.key]).toEqual(["month", "6m", "year"]);
    expect(month.chart!.points).toHaveLength(2);
    expect(sixMonths.chart!.points).toHaveLength(3);
    expect(year.chart!.points).toHaveLength(4);
    expect(month.changeLb).toBe(-3);
    expect(year.changeLb).toBe(-20);
  });

  it("has no chart or change for a window without enough weigh-ins", () => {
    const [month] = buildTrendWindows(
      testDashboardData({ weightTrend: [trendRow({ local_date: "2026-09-20", weight_lb: 229, avg7_lb: 230 })] }),
    );
    expect(month.chart!.points).toHaveLength(1);
    expect(month.changeLb).toBeNull();
    expect(buildTrendWindows(testDashboardData())[0].chart).toBeNull();
  });
});
