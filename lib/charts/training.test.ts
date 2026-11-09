import { describe, expect, it } from "vitest";
import type { DateRange } from "@/lib/dashboard/types";
import { testDashboardData, testProfile, testRide, testRun, testTraining as training } from "@/lib/kpis/testing";
import { buildLoadFocus, buildTrainingLoad, buildZoneChart, trainingStatus } from "./training";

const WEEK: DateRange = { key: "week", from: "2026-10-28", to: "2026-11-03" };
const MONTH: DateRange = { key: "month", from: "2026-10-04", to: "2026-11-03" };
const BOUNDS: [number, number][] = [[101, 120], [121, 140], [141, 160], [161, 180], [181, 201]];

describe("buildZoneChart", () => {
  const activities = [
    testRun({ local_date: "2026-10-20", hr_zone_s: [600, 600, 0, 0, 0] }), // outside the week, inside the month
    testRun({ local_date: "2026-11-01", hr_zone_s: [300, 1500, 600, 0, 0] }),
    testRun({ local_date: "2026-11-03", hr_zone_s: [9, 158, 1017, 544, 0] }), // the real tempo run
    testRun({ local_date: "2026-11-02", hr_zone_s: null }), // no HR: ignored
  ];

  it("stacks minutes per day within a week and computes the easy share", () => {
    const data = testDashboardData({ activities, dateRange: WEEK, today: "2026-11-03", profile: testProfile({ hr_zone_bounds: BOUNDS }) });
    const chart = buildZoneChart(data)!;
    expect(chart.weekly).toBe(false);
    expect(chart.bars).toHaveLength(7);
    expect(chart.bars.at(-1)!.minutes[2]).toBeCloseTo(1017 / 60, 6);
    const easy = 300 + 1500 + 9 + 158;
    const total = easy + 600 + 1017 + 544;
    expect(chart.easyShare).toBeCloseTo(easy / total, 6);
    expect(chart.easyShareLast7).toBeCloseTo(easy / total, 6);
    expect(chart.totalMinutes).toBeCloseTo(total / 60, 6);
    expect(chart.bounds).toEqual(BOUNDS);
    // Miles count every run, the HR-less one on Nov 2 too (testRun is 3 mi).
    expect(chart.totalMiles).toBeCloseTo(9, 6);
    expect(chart.count).toBe(3);
    expect(chart.bars.map((b) => b.miles)).toEqual([0, 0, 0, 0, 3, 3, 3]);
  });

  it("groups by week past seven days", () => {
    const chart = buildZoneChart(testDashboardData({ activities, dateRange: MONTH, today: "2026-11-03" }))!;
    expect(chart.weekly).toBe(true);
    expect(chart.bars.map((b) => b.label)).toEqual(["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01"]);
    expect(chart.bars[2].minutes[0]).toBe(10);
  });

  it("still shows miles when no run in range has HR zones", () => {
    const chart = buildZoneChart(testDashboardData({ activities: [testRun({ local_date: "2026-11-02", hr_zone_s: null })], dateRange: WEEK, today: "2026-11-03" }))!;
    expect(chart.totalMinutes).toBe(0);
    expect(chart.totalMiles).toBeCloseTo(3, 6);
  });

  it("is null with no runs in range", () => {
    expect(buildZoneChart(testDashboardData({ activities: [], dateRange: WEEK }))).toBeNull();
  });

  const CYCLING: [number, number][] = [[97, 115], [116, 134], [135, 153], [154, 173], [174, 193]];
  const mixed = [...activities, testRide({ local_date: "2026-11-02", hr_zone_s: [0, 1800, 1800, 0, 0] })];
  const profile = testProfile({ hr_zone_bounds: BOUNDS, hr_zone_bounds_cycling: CYCLING });

  it("under Ride, counts only rides and labels them with the cycling zones", () => {
    const chart = buildZoneChart(testDashboardData({ sport: "ride", activities: mixed, dateRange: WEEK, today: "2026-11-03", profile }))!;
    expect(chart.count).toBe(1);
    expect(chart.totalMiles).toBeCloseTo(15, 6);
    expect(chart.easyShare).toBeCloseTo(0.5, 6);
    expect(chart.bounds).toEqual(CYCLING);
  });

  it("under All, adds rides and runs but shows no single set of bpm bounds", () => {
    const chart = buildZoneChart(testDashboardData({ sport: "all", activities: mixed, dateRange: WEEK, today: "2026-11-03", profile }))!;
    expect(chart.count).toBe(4);
    expect(chart.bounds).toBeNull();
  });
});

describe("trainingStatus", () => {
  it("pairs each status with a glyph and tone", () => {
    expect(trainingStatus("PRODUCTIVE")).toEqual({ label: "Productive", glyph: "▲", tone: "good" });
    expect(trainingStatus("DETRAINING")?.glyph).toBe("▼");
    expect(trainingStatus("NO_STATUS")).toEqual({ label: "No status", glyph: "○", tone: "neutral" });
    expect(trainingStatus(null)).toBeNull();
  });
});

describe("buildTrainingLoad", () => {
  it("reads acute, chronic and the band, with the latest day's ACWR and status", () => {
    const rows = [
      training({ local_date: "2026-11-02", acute_load: 220, chronic_load: 170, chronic_low: 136, chronic_high: 255 }),
      training({ local_date: "2026-11-03", acute_load: 237, chronic_load: 172, chronic_low: 137.6, chronic_high: 258, acwr: 1.3, status: "PRODUCTIVE" }),
    ];
    const data = buildTrainingLoad({ training: rows, dateRange: WEEK, today: "2026-11-03" })!;
    expect(data.points.map((p) => p.acute)).toEqual([220, 237]);
    expect(data.latest).toMatchObject({ acute: 237, chronic: 172, acwr: 1.3, acwrState: "optimal" });
    expect(data.latest.status?.label).toBe("Productive");
  });

  it("flags an ACWR outside 0.8 to 1.5", () => {
    const rows = [training({ local_date: "2026-11-03", acute_load: 300, chronic_load: 150, acwr: 2 })];
    expect(buildTrainingLoad({ training: rows, dateRange: WEEK, today: "2026-11-03" })!.latest.acwrState).toBe("high");
  });

  it("is null without load in range", () => {
    expect(buildTrainingLoad({ training: [training({ local_date: "2026-11-03" })], dateRange: WEEK, today: "2026-11-03" })).toBeNull();
  });
});

describe("buildLoadFocus", () => {
  it("places each focus against its target range", () => {
    const focus = {
      aerobic_low: { value: 300.9, low: 80, high: 240 },
      aerobic_high: { value: 200, low: 120, high: 240 },
      anaerobic: { value: 0, low: 0, high: 140 },
    };
    const data = buildLoadFocus({ training: [training({ local_date: "2026-11-03", focus, focus_feedback: "ABOVE_TARGETS" })], today: "2026-11-03" })!;
    expect(data.bars.map((b) => [b.label, b.state])).toEqual([
      ["Aerobic low", "above"],
      ["Aerobic high", "in"],
      ["Anaerobic", "in"],
    ]);
    expect(data.max).toBeCloseTo(300.9 * 1.08, 6);
    expect(data.feedback).toBe("ABOVE_TARGETS");
  });

  it("calls a value under its target below", () => {
    const focus = { aerobic_low: { value: 50, low: 80, high: 240 }, aerobic_high: { value: 130, low: 120, high: 240 }, anaerobic: { value: 10, low: 0, high: 140 } };
    expect(buildLoadFocus({ training: [training({ local_date: "2026-11-03", focus })], today: "2026-11-03" })!.bars[0].state).toBe("below");
  });

  it("is null without focus data", () => {
    expect(buildLoadFocus({ training: [], today: "2026-11-03" })).toBeNull();
  });
});
