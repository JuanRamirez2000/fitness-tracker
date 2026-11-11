import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun } from "@/lib/kpis/testing";
import { buildPowerZones, buildSessionCost, buildSessionMix, buildWeeklyVolume, sportsInRange } from "./all-sports";
import { buildSportLoad } from "./training";

const RANGE = { key: "custom" as const, from: "2026-11-01", to: "2026-11-14" };
const swim = (local_date: string, over = {}) =>
  testRun({ local_date, id: `00000000-0000-4000-a000-${local_date.replaceAll("-", "").padStart(12, "0")}`, activity_type: "lap_swimming", duration_s: 1800, moving_duration_s: 1800, ...over });

describe("sportsInRange", () => {
  it("lists only sports with activities inside the range", () => {
    const data = testDashboardData({ dateRange: RANGE, today: "2026-11-14", activities: [testRide({ local_date: "2026-11-02" }), testRun({ local_date: "2026-10-01" }), swim("2026-11-03")] });
    expect(sportsInRange(data)).toEqual(["ride", "swim"]);
  });
});

describe("buildWeeklyVolume", () => {
  it("stacks hours by sport per day for a two-week range, with each bar's load", () => {
    const data = testDashboardData({
      sport: "all",
      dateRange: RANGE,
      today: "2026-11-14",
      activities: [
        testRide({ local_date: "2026-11-02", training_load: 40 }),
        testRun({ local_date: "2026-11-02", training_load: 30 }),
        swim("2026-11-05", { training_load: 10 }),
      ],
    });
    const chart = buildWeeklyVolume(data)!;
    expect(chart.weekly).toBe(false);
    expect(chart.bars).toHaveLength(14);
    const nov2 = chart.bars.find((b) => b.label === "2026-11-02")!;
    expect(nov2.hours.ride).toBeCloseTo(1, 6);
    expect(nov2.hours.run).toBeCloseTo(0.6, 6);
    expect(nov2.load).toBe(70);
    expect(chart.sports).toEqual(["ride", "run", "swim"]);
    expect(chart.totalHours).toBeCloseTo(2.1, 6);
  });

  it("follows a single-sport filter", () => {
    const data = testDashboardData({ sport: "ride", dateRange: RANGE, activities: [testRide({ local_date: "2026-11-02" }), testRun({ local_date: "2026-11-02" })] });
    expect(buildWeeklyVolume(data)!.sports).toEqual(["ride"]);
  });

  it("is null with nothing in range", () => {
    expect(buildWeeklyVolume(testDashboardData({ dateRange: RANGE, activities: [] }))).toBeNull();
  });
});

describe("buildSportLoad", () => {
  it("sums one sport's loads over 7 days against a 4-week weekly average", () => {
    const data = testDashboardData({
      dateRange: { key: "custom", from: "2026-11-14", to: "2026-11-14" },
      today: "2026-11-14",
      activities: [
        testRide({ local_date: "2026-11-13", training_load: 50 }),
        testRide({ local_date: "2026-11-01", training_load: 30 }),
        testRide({ local_date: "2026-10-20", training_load: 40 }),
        testRun({ local_date: "2026-11-12", training_load: 100 }),
      ],
    });
    const load = buildSportLoad(data, "ride")!;
    expect(load.latest.acute).toBe(50);
    expect(load.latest.chronic).toBe(30); // (50 + 30 + 40) / 4
    expect(load.latest.acwr).toBeNull(); // rides only began 25 days ago
    expect(load.latest.status).toBeNull();
    expect(buildSportLoad(data, "swim")).toBeNull();
  });

  it("gives a ratio once the sport has four weeks behind it", () => {
    const data = testDashboardData({
      dateRange: { key: "custom", from: "2026-11-14", to: "2026-11-14" },
      today: "2026-11-14",
      activities: [testRide({ local_date: "2026-11-13", training_load: 50 }), testRide({ local_date: "2026-10-18", training_load: 30 })],
    });
    expect(buildSportLoad(data, "ride")!.latest.acwr).toBeCloseTo(50 / 20, 6);
  });
});

describe("buildPowerZones", () => {
  it("adds up each power zone across the range's rides", () => {
    const data = testDashboardData({
      sport: "all",
      dateRange: RANGE,
      activities: [
        testRide({ local_date: "2026-11-02", power_zone_s: [600, 1200, 600, 0, 0, 0, 0] }),
        testRide({ local_date: "2026-11-03", power_zone_s: [0, 600, 0, 600, 0, 0, 0] }),
        testRide({ local_date: "2026-11-04", power_zone_s: null }),
      ],
    });
    const chart = buildPowerZones(data)!;
    expect(chart.rides).toBe(2);
    expect(chart.totalMinutes).toBe(60);
    expect(chart.zones[1]).toMatchObject({ label: "Z2", name: "Endurance", minutes: 30, share: 0.5 });
  });
});

describe("buildSessionMix", () => {
  it("files each labelled session under its benefit and week", () => {
    const data = testDashboardData({
      sport: "all",
      dateRange: RANGE,
      activities: [
        testRide({ local_date: "2026-11-02", training_effect_label: "AEROBIC_BASE" }),
        testRun({ local_date: "2026-11-03", training_effect_label: "LACTATE_THRESHOLD" }),
        testRide({ local_date: "2026-11-10", training_effect_label: "TEMPO" }),
        testRun({ local_date: "2026-11-11", training_effect_label: "UNKNOWN" }),
      ],
    });
    const chart = buildSessionMix(data)!;
    expect(chart.weeks).toEqual(["2026-11-01", "2026-11-08"]);
    expect(chart.rows.find((r) => r.key === "AEROBIC_BASE")!.cells[0].map((s) => s.sport)).toEqual(["ride"]);
    expect(chart.rows.find((r) => r.key === "LACTATE_THRESHOLD")!.cells[0].map((s) => s.sport)).toEqual(["run"]);
    expect(chart.counts).toEqual({ easy: 1, tempo: 1, hard: 1 });
  });
});

describe("buildSessionCost", () => {
  it("pairs load with Body Battery drained and gives each sport's median cost per 10 load", () => {
    const data = testDashboardData({
      sport: "all",
      dateRange: RANGE,
      activities: [
        testRide({ local_date: "2026-11-02", training_load: 40, body_battery_change: -4 }),
        testRide({ local_date: "2026-11-03", training_load: 20, body_battery_change: -4 }),
        testRun({ local_date: "2026-11-04", training_load: 100, body_battery_change: -11 }),
        testRun({ local_date: "2026-11-05", training_load: 10, body_battery_change: null }),
      ],
    });
    const chart = buildSessionCost(data)!;
    expect(chart.points).toHaveLength(3);
    expect(chart.costPer10).toEqual([{ sport: "ride", value: 1.5, sessions: 2 }]);
  });
});
