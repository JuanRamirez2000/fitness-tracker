import { describe, expect, it } from "vitest";
import { testDashboardData, testRun } from "@/lib/kpis/testing";
import { buildRunEfficiency } from "./run-efficiency";

const SEPT = { key: "custom" as const, from: "2026-09-01", to: "2026-09-30" };

describe("buildRunEfficiency", () => {
  it("scores easy runs in range with a rolling median that can look back before it", () => {
    const data = testDashboardData({
      dateRange: SEPT,
      activities: [
        testRun({ local_date: "2026-08-20", avg_hr: 140 }), // feeds the first trend point only
        testRun({ local_date: "2026-09-05" }),
        testRun({ local_date: "2026-09-12", training_effect_label: "THRESHOLD" }), // workout, skipped
        testRun({ local_date: "2026-09-19", avg_hr: 120 }),
      ],
    });
    const chart = buildRunEfficiency(data)!;
    expect(chart.points.map((p) => p.local_date)).toEqual(["2026-09-05", "2026-09-19"]);
    expect(chart.points[0].pace).toBeCloseTo(720);
    expect(chart.points[0].trend).toBeCloseTo((720 + 720 * (140 / 130)) / 2);
    expect(chart.changeSec).toBeLessThan(0); // faster at the same heart rate
    expect(chart.paceDomain[0]).toBeGreaterThan(chart.paceDomain[1]); // slow at the bottom
  });

  it("is null without an easy run in range", () => {
    expect(buildRunEfficiency(testDashboardData({ dateRange: SEPT }))).toBeNull();
  });
});
