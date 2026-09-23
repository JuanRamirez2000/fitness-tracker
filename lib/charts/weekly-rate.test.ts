import { describe, expect, it } from "vitest";
import { testDashboardData, trendRow } from "@/lib/kpis/testing";
import { buildWeeklyRate } from "./weekly-rate";

describe("buildWeeklyRate", () => {
  it("is empty with fewer than two weeks that have a weigh-in", () => {
    const data = testDashboardData({
      dateRange: { key: "month", from: "2026-09-01", to: "2026-09-14" },
      weightTrend: [trendRow({ local_date: "2026-09-03", weight_lb: 220, avg7_lb: 220 })],
    });
    expect(buildWeeklyRate(data)).toEqual([]);
  });

  it("reports the change from one week's average weight to the next", () => {
    // Week 1 (Sun 08-30 - Sat 09-05): avg 220. Week 2 (09-06 - 09-12): avg 218.
    const data = testDashboardData({
      dateRange: { key: "custom", from: "2026-08-30", to: "2026-09-12" },
      weightTrend: [
        trendRow({ local_date: "2026-09-01", weight_lb: 220, avg7_lb: 220 }),
        trendRow({ local_date: "2026-09-03", weight_lb: 220, avg7_lb: 220 }),
        trendRow({ local_date: "2026-09-08", weight_lb: 216, avg7_lb: 217 }),
        trendRow({ local_date: "2026-09-10", weight_lb: 220, avg7_lb: 219 }),
      ],
    });
    const rate = buildWeeklyRate(data);
    expect(rate).toHaveLength(1);
    expect(rate[0].rate).toBeCloseTo(218 - 220, 10);
  });

  it("skips a week with no weigh-in rather than treating it as zero", () => {
    const data = testDashboardData({
      dateRange: { key: "custom", from: "2026-08-30", to: "2026-09-19" },
      weightTrend: [
        trendRow({ local_date: "2026-09-01", weight_lb: 220, avg7_lb: 220 }), // week 1
        // week 2 (09-06 - 09-12) has nothing logged
        trendRow({ local_date: "2026-09-15", weight_lb: 216, avg7_lb: 216 }), // week 3
      ],
    });
    // Only weeks 1 and 3 have data, so there is exactly one delta between them.
    expect(buildWeeklyRate(data)).toEqual([{ weekStart: "2026-09-13", rate: 216 - 220 }]);
  });
});
