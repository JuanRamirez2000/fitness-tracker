import { describe, expect, it } from "vitest";
import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import { addDays } from "@/lib/dates/calendar";
import { TODAY, testDashboardData } from "@/lib/kpis/testing";
import { buildReadinessTrend } from "./readiness";
import { buildSleepTiming } from "./sleep-timing";

const WEEK = { key: "week" as const, from: addDays(TODAY, -6), to: TODAY };

const ready = (daysAgo: number, over: Partial<DailyRecovery> = {}): DailyRecovery =>
  ({
    local_date: addDays(TODAY, -daysAgo),
    readiness_score: 40,
    readiness_morning_score: 70,
    readiness_factors: { sleep_history: 65, hrv: 100, recovery_time: 50, acwr: 80, stress_history: 90, sleep: 85 },
    ...over,
  }) as DailyRecovery;

/** A night that ended `daysAgo` days ago: to bed at `bedUtc` (the evening before, UTC) and up at `wakeUtc` (UTC). */
const night = (daysAgo: number, bedUtc: string, wakeUtc: string, over: Partial<SleepNight> = {}): SleepNight => {
  const day = addDays(TODAY, -daysAgo);
  return {
    local_date: day,
    bedtime: `${day}T${bedUtc}:00Z`,
    wake_time: `${day}T${wakeUtc}:00Z`,
    duration_s: 7 * 3600,
    need_s: 8 * 3600,
    ...over,
  } as SleepNight;
};

describe("buildReadinessTrend", () => {
  it("uses the score at wake, keeps each morning's factors, and finds the weakest one", () => {
    const recovery = [ready(2), ready(1, { readiness_morning_score: 45 }), ready(0, { readiness_morning_score: null, readiness_score: 80 })];
    const t = buildReadinessTrend(testDashboardData({ recovery, dateRange: WEEK }))!;
    expect(t.days.map((d) => d.score)).toEqual([70, 45, 80]);
    expect(t).toMatchObject({ lowDays: 1, highDays: 1, weakest: { key: "recovery_time", lowDays: 3 } });
    expect(t.average).toBeCloseTo(65);
    expect(t.latest.factors.hrv).toBe(100);
  });

  it("is null without readiness in range", () => {
    expect(buildReadinessTrend(testDashboardData({ recovery: [ready(20)], dateRange: WEEK }))).toBeNull();
  });
});

describe("buildSleepTiming", () => {
  // Late September in Los Angeles is UTC-7: 06:30Z is 11:30 pm the evening before, 13:45Z is 6:45 am.
  it("reads each night's bedtime and wake time in the athlete's zone", () => {
    const sleep = [night(1, "06:30", "13:45"), night(0, "07:30", "14:45")];
    const t = buildSleepTiming(testDashboardData({ sleep, dateRange: WEEK }))!;
    expect(t.bars.map((b) => [b.bed, b.wake])).toEqual([
      [-30, 405],
      [30, 465],
    ]);
    expect(t.medianBed).toBe(0);
    expect(t.bedSpread).toBe(30);
  });

  it("runs a 7-night sleep debt through the range, counting nights before it", () => {
    const sleep = [night(8, "06:30", "13:45"), night(1, "06:30", "13:45"), night(0, "06:30", "13:45")];
    const t = buildSleepTiming(testDashboardData({ sleep, dateRange: { key: "week", from: TODAY, to: TODAY } }))!;
    // Tonight and last night are an hour short each; the night 8 days ago is outside the 7.
    expect(t.debt).toEqual([{ date: TODAY, hours: 2 }]);
  });

  it("is null without timed nights in range", () => {
    expect(buildSleepTiming(testDashboardData({ sleep: [night(0, "06:30", "13:45", { bedtime: null })], dateRange: WEEK }))).toBeNull();
  });
});
