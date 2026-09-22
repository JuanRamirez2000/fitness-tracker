import { describe, expect, it } from "vitest";
import { testDashboardData, trendRow, TODAY } from "./testing";
import { todaysWeight } from "./todays-weight";

describe("todaysWeight", () => {
  it("is the empty state when today has no weigh-in", () => {
    expect(todaysWeight.compute(testDashboardData())).toBeNull();
  });

  it("shows the weight, a good tone for a loss, and formats to one decimal", () => {
    const data = testDashboardData({
      weightTrend: [trendRow({ local_date: TODAY, weight_lb: 230.4, raw_delta_lb: -1.2 })],
    });
    const value = todaysWeight.compute(data)!;
    expect(value.tone).toBe("good");
    expect(todaysWeight.format(value)).toEqual({ primary: "230.4", delta: "−1.2 lb", tone: "good" });
  });

  it("is a bad tone for a gain and neutral with no comparison yet", () => {
    const gain = todaysWeight.compute(
      testDashboardData({ weightTrend: [trendRow({ local_date: TODAY, weight_lb: 231, raw_delta_lb: 0.6 })] }),
    )!;
    expect(gain.tone).toBe("bad");

    const first = todaysWeight.compute(
      testDashboardData({ weightTrend: [trendRow({ local_date: TODAY, weight_lb: 232.4 })] }),
    )!;
    expect(first.tone).toBe("neutral");
    expect(todaysWeight.format(first).delta).toBeUndefined();
  });

  it("takes only the most recent 30 recorded days for the sparkline", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      trendRow({ local_date: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`, weight_lb: 200 + i }),
    );
    rows[rows.length - 1] = trendRow({ local_date: TODAY, weight_lb: 240 });
    const value = todaysWeight.compute(testDashboardData({ weightTrend: rows }))!;
    expect(value.series).toHaveLength(30);
    expect(value.series!.at(-1)).toBe(240);
  });
});
