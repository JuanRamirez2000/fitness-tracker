import { describe, expect, it } from "vitest";
import { testDashboardData, testRun } from "@/lib/kpis/testing";
import { buildFastestMile } from "./fastest-mile";
import { buildRunEfficiency } from "./run-efficiency";
import { buildRunningVolume } from "./running-volume";

const SEPT = { key: "custom" as const, from: "2026-09-01", to: "2026-09-30" };

describe("buildRunningVolume", () => {
  it("totals each day's runs in range, ignoring other activities", () => {
    const data = testDashboardData({
      dateRange: SEPT,
      activities: [
        testRun({ local_date: "2026-08-31" }), // before the range
        testRun({ local_date: "2026-09-05" }),
        testRun({ local_date: "2026-09-05", id: "00000000-0000-4000-8000-000000000001", distance_m: 1609.344 }),
        testRun({ local_date: "2026-09-06", activity_type: "cycling" }),
      ],
    });
    const volume = buildRunningVolume(data);
    expect(volume.aggregated).toBe(false);
    expect(volume.bars).toHaveLength(30);
    expect(volume.bars.find((b) => b.label === "2026-09-05")).toMatchObject({ runs: 2 });
    expect(volume.totalMiles).toBeCloseTo(4);
    expect(volume.runCount).toBe(2);
  });

  it("switches to weekly totals on a long range", () => {
    const data = testDashboardData({ dateRange: { key: "6m", from: "2026-03-20", to: "2026-09-20" } });
    expect(buildRunningVolume(data).aggregated).toBe(true);
  });
});

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

describe("buildFastestMile", () => {
  it("tracks the all-time best mile, including PRs from before the range", () => {
    const data = testDashboardData({
      dateRange: SEPT,
      activities: [
        testRun({ local_date: "2026-08-01", fastest_mile_s: 600 }),
        testRun({ local_date: "2026-09-05", fastest_mile_s: 650 }),
        testRun({ local_date: "2026-09-19", fastest_mile_s: 590 }),
      ],
    });
    const chart = buildFastestMile(data)!;
    expect(chart.points.map((p) => [p.seconds, p.best])).toEqual([
      [650, 600],
      [590, 590],
    ]);
    expect(chart.allTimeBest).toEqual({ seconds: 590, local_date: "2026-09-19" });
  });
});
