import { describe, expect, it } from "vitest";
import { testDashboardData, testRun, trendRow } from "@/lib/kpis/testing";
import { buildDays, has } from "./days";

describe("buildDays", () => {
  it("lays out every day to today with what it has", () => {
    const data = testDashboardData({
      today: "2026-11-18",
      activities: [testRun({ local_date: "2026-11-17", training_load: 41.6 })],
      weightTrend: [trendRow({ local_date: "2026-11-16", weight_lb: 265.4 })],
    });
    const days = buildDays(data, "2026-11-16", "2026-11-22");
    expect(days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(days[0]).toMatchObject({ weightLb: 265.4, activities: [] });
    expect(days[1]).toMatchObject({ load: 42, activities: [{ sport: "run", minutes: 36 }] });
    expect(has(days[1], "activities")).toBe(true);
    expect(has(days[2], "weight")).toBe(false);
  });
});
