import { describe, expect, it } from "vitest";
import { loggingStreak } from "./logging-streak";
import { testDashboardData, trendRow, TODAY } from "./testing";

describe("loggingStreak", () => {
  it("is 0, not an empty state, with no weigh-ins", () => {
    const value = loggingStreak.compute(testDashboardData())!;
    expect(value).not.toBeNull();
    expect(value.value).toBe(0);
    expect(value.unit).toBe("days");
  });

  it("counts consecutive days ending today", () => {
    const data = testDashboardData({
      weightTrend: [
        trendRow({ local_date: "2026-09-18", weight_lb: 231 }),
        trendRow({ local_date: "2026-09-19", weight_lb: 230.5 }),
        trendRow({ local_date: TODAY, weight_lb: 230 }),
      ],
    });
    expect(loggingStreak.compute(data)!.value).toBe(3);
  });

  it("stops at the first gap walking backward from today", () => {
    const data = testDashboardData({
      weightTrend: [
        trendRow({ local_date: "2026-09-17", weight_lb: 232 }),
        // 09-18 missing
        trendRow({ local_date: "2026-09-19", weight_lb: 230.5 }),
        trendRow({ local_date: TODAY, weight_lb: 230 }),
      ],
    });
    expect(loggingStreak.compute(data)!.value).toBe(2);
  });

  it("is 0 when today itself has no weigh-in, even with a streak before it", () => {
    const data = testDashboardData({
      weightTrend: [
        trendRow({ local_date: "2026-09-17", weight_lb: 232 }),
        trendRow({ local_date: "2026-09-18", weight_lb: 231 }),
      ],
    });
    expect(loggingStreak.compute(data)!.value).toBe(0);
  });

  it("does not walk past the program start", () => {
    const data = testDashboardData({
      programStart: "2026-09-19",
      weightTrend: [
        trendRow({ local_date: "2026-09-10", weight_lb: 235 }), // before the program; ignored
        trendRow({ local_date: "2026-09-19", weight_lb: 231 }),
        trendRow({ local_date: TODAY, weight_lb: 230 }),
      ],
    });
    expect(loggingStreak.compute(data)!.value).toBe(2);
  });

  it("uses the singular unit for exactly 1", () => {
    const data = testDashboardData({ weightTrend: [trendRow({ local_date: TODAY, weight_lb: 230 })] });
    expect(loggingStreak.compute(data)!.unit).toBe("day");
  });
});
