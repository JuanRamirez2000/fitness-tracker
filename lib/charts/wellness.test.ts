import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/data/profiles";
import type { DateRange } from "@/lib/dashboard/types";
import { eachDay } from "@/lib/dates/calendar";
import { testNight, testRecovery } from "@/lib/today/testing";
import { buildBodyBattery } from "./body-battery";
import { buildHeartChart } from "./heart";
import { bedtimeMinutes, buildSleepChart, fmtBedtime } from "./sleep";

const PROFILE = { timezone: "America/Los_Angeles" } as Profile;
const WEEK: DateRange = { key: "week", from: "2026-10-28", to: "2026-11-03" };
const QUARTER: DateRange = { key: "custom", from: "2026-08-01", to: "2026-11-03" };

describe("bedtimeMinutes and fmtBedtime", () => {
  it("counts evening bedtimes as negative and after-midnight ones as positive", () => {
    expect(bedtimeMinutes("2026-11-03T07:03:35Z", "America/Los_Angeles")).toBe(-57); // 11:03 pm
    expect(bedtimeMinutes("2026-11-03T09:15:00Z", "America/Los_Angeles")).toBe(75); // 1:15 am
  });

  it("formats minutes from midnight as a clock time", () => {
    expect(fmtBedtime(-60)).toBe("11 pm");
    expect(fmtBedtime(75)).toBe("1:15 am");
    expect(fmtBedtime(0)).toBe("12 am");
  });
});

describe("buildSleepChart", () => {
  it("draws one bar per night in a week, with stats and the mean need", () => {
    const sleep = [
      testNight({ local_date: "2026-10-27" }), // outside the range
      testNight({ local_date: "2026-11-02", duration_s: 21600, need_s: 28800, score: 70 }),
      testNight({ local_date: "2026-11-03" }),
    ];
    const chart = buildSleepChart({ sleep, dateRange: WEEK, profile: PROFILE })!;
    expect(chart.weekly).toBe(false);
    expect(chart.bars.map((b) => b.label)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(chart.bars[1].hours.deep).toBeCloseTo(2.05, 2);
    expect(chart.lastNight).toEqual({ date: "2026-11-03", hours: 7.5, score: 85 });
    expect(chart.avgHours).toBeCloseTo(6.75, 2);
    expect(chart.needHours).toBeCloseTo((8 + 27600 / 3600) / 2, 3);
    expect(chart.scores.map((p) => p.value)).toEqual([70, 85]);
    expect(chart.bedtimes[0].value).toBe(-57);
  });

  it("switches to weekly means past 35 days", () => {
    const sleep = eachDay("2026-10-01", "2026-11-03").map((d) => testNight({ local_date: d }));
    const chart = buildSleepChart({ sleep, dateRange: QUARTER, profile: PROFILE })!;
    expect(chart.weekly).toBe(true);
    expect(chart.bars.length).toBe(6); // weeks starting Sep 27 .. Nov 1 that have nights
    expect(chart.nights).toBe(34);
  });

  it("is null with no nights in range", () => {
    expect(buildSleepChart({ sleep: [testNight({ local_date: "2026-10-01" })], dateRange: WEEK, profile: PROFILE })).toBeNull();
  });
});

describe("buildHeartChart", () => {
  it("marks HRV outside its band and reports latest values and deltas", () => {
    const recovery = [
      testRecovery({ local_date: "2026-10-28", resting_hr: 52, hrv_ms: 43, hrv_baseline_low: 39, hrv_baseline_high: 50 }),
      testRecovery({ local_date: "2026-10-29", resting_hr: 50, hrv_ms: 36, hrv_baseline_low: 39, hrv_baseline_high: 50 }),
      testRecovery({ local_date: "2026-11-03", resting_hr: 51, hrv_ms: 44, hrv_baseline_low: null, hrv_baseline_high: null }),
    ];
    const chart = buildHeartChart({ recovery, dateRange: WEEK })!;
    expect(chart.hrv.map((p) => p.inBand)).toEqual([true, false, true]);
    expect(chart.hrvOutOfBand).toBe(1);
    expect(chart.rhrLatest).toBe(51);
    expect(chart.rhrDelta).toBe(-1);
    expect(chart.hrvDelta).toBe(1);
  });

  it("is null with neither series in range", () => {
    expect(buildHeartChart({ recovery: [testRecovery({ local_date: "2026-11-03" })], dateRange: WEEK })).toBeNull();
  });
});

describe("buildBodyBattery", () => {
  it("keeps daily bars in a week and skips days without a range", () => {
    const recovery = [
      testRecovery({ local_date: "2026-11-02", body_battery_high: 70, body_battery_low: 15, body_battery_wake: 61 }),
      testRecovery({ local_date: "2026-11-03", body_battery_high: 80, body_battery_low: 18, body_battery_wake: 80 }),
      testRecovery({ local_date: "2026-11-01", resting_hr: 50 }),
    ];
    const data = buildBodyBattery({ recovery, dateRange: WEEK })!;
    expect(data.weekly).toBe(false);
    expect(data.bars).toEqual([
      { label: "2026-11-02", high: 70, low: 15, wake: 61 },
      { label: "2026-11-03", high: 80, low: 18, wake: 80 },
    ]);
    expect(data.latestWake).toBe(80);
    expect(data.avgWake).toBe(70.5);
  });

  it("averages weeks past 35 days", () => {
    const recovery = eachDay("2026-10-25", "2026-11-07").map((d, i) =>
      testRecovery({ local_date: d, body_battery_high: 60 + (i % 7), body_battery_low: 10, body_battery_wake: 50 }),
    );
    const data = buildBodyBattery({ recovery, dateRange: { key: "custom", from: "2026-08-01", to: "2026-11-07" } })!;
    expect(data.weekly).toBe(true);
    expect(data.bars).toEqual([
      { label: "2026-10-25", high: 63, low: 10, wake: 50 },
      { label: "2026-11-01", high: 63, low: 10, wake: 50 },
    ]);
  });
});
