import { describe, expect, it } from "vitest";
import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import type { BodyCompositionDay } from "@/lib/data/weigh-ins";
import { addDays } from "@/lib/dates/calendar";
import { TAB_KPIS, KPIS } from "@/dashboard.config";
import { bodyFat } from "./body-fat";
import { hrv } from "./hrv";
import { loadRatio } from "./load-ratio";
import { race5k } from "./race-5k";
import { restingHr } from "./resting-hr";
import { sleepDebt } from "./sleep-debt";
import { sleepScore } from "./sleep-score";
import { TODAY, testDashboardData, testTraining } from "./testing";

const night = (daysAgo: number, over: Partial<SleepNight> = {}): SleepNight =>
  ({ user_id: "u", local_date: addDays(TODAY, -daysAgo), bedtime: null, wake_time: null, duration_s: 7 * 3600, deep_s: 0, rem_s: 0, light_s: 0, awake_s: 0, score: 80, need_s: 8 * 3600, ...over }) as SleepNight;
const day = (daysAgo: number, over: Partial<DailyRecovery> = {}): DailyRecovery =>
  ({ local_date: addDays(TODAY, -daysAgo), resting_hr: 52, hrv_ms: 45, hrv_baseline_low: 40, hrv_baseline_high: 50, ...over }) as DailyRecovery;

describe("tab rows", () => {
  it("fills exactly one six-unit row on every tab", () => {
    for (const [tab, ids] of Object.entries(TAB_KPIS)) {
      const units = ids.reduce((sum, id) => sum + (KPIS.find((k) => k.id === id)?.span ?? 1), 0);
      expect(units, tab).toBe(6);
    }
  });
});

describe("sleepScore", () => {
  it("is last night's score against the week before it", () => {
    const sleep = [...[7, 6, 5, 4, 3, 2, 1].map((d) => night(d, { score: 70 })), night(0, { score: 84, duration_s: 6.5 * 3600 })];
    const v = sleepScore.compute(testDashboardData({ sleep }))!;
    expect(v).toMatchObject({ value: 84, delta: 14, tone: "good", sub: "Last night · 6.5 h · vs the week's 70" });
    expect(v.points!.at(-1)).toMatchObject({ value: 84, text: "84 · 6.5 h" });
  });
});

describe("sleepDebt", () => {
  it("adds up the last 7 nights' shortfall against need", () => {
    const sleep = [6, 5, 4, 3, 2, 1, 0].map((d) => night(d)); // an hour short each night, oldest first like the query
    const v = sleepDebt.compute(testDashboardData({ sleep }))!;
    expect(v.value).toBeCloseTo(7);
    expect(v).toMatchObject({ deltaText: "behind", tone: "warn", sub: "Last 7 nights · 7.0 of 8.0 h a night" });
  });

  it("is caught up when nights beat the need", () => {
    const v = sleepDebt.compute(testDashboardData({ sleep: [night(0, { duration_s: 9 * 3600 })] }))!;
    expect(v).toMatchObject({ value: 0, deltaText: "caught up", tone: "good" });
  });
});

describe("hrv", () => {
  it("averages a week of nights and says where that sits in the normal range, with the band", () => {
    const recovery = [3, 2, 1, 0].map((d) => day(d, { hrv_ms: 36 }));
    const v = hrv.compute(testDashboardData({ recovery }))!;
    expect(v).toMatchObject({ value: 36, deltaText: "below range", tone: "warn", sub: "Last night 36 ms · normal 40–50 ms" });
    expect(v.points![0]).toMatchObject({ low: 40, high: 50 });
    expect(hrv.span).toBe(2);
  });
});

describe("restingHr", () => {
  it("compares this morning with the 30-day average; lower is good", () => {
    const recovery = [...[5, 4, 3, 2, 1].map((d) => day(d, { resting_hr: 54 })), day(0, { resting_hr: 51 })];
    expect(restingHr.compute(testDashboardData({ recovery }))).toMatchObject({ value: 51, delta: -3, tone: "good" });
  });
});

describe("bodyFat", () => {
  it("is the latest reading against one at least a month earlier", () => {
    const comp = (date: string, pct: number) => ({ local_date: date, weight_lb: 270, body_fat_pct: pct, muscle_mass_lb: null, bone_mass_lb: null, body_water_pct: null }) as BodyCompositionDay;
    const v = bodyFat.compute(testDashboardData({ bodyComposition: [comp(addDays(TODAY, -40), 35), comp(TODAY, 33.8)] }))!;
    expect(v.delta).toBeCloseTo(-1.2);
    expect(bodyFat.format(v)).toMatchObject({ primary: "33.8", delta: "−1.2 pts", tone: "good" });
  });
});

describe("loadRatio", () => {
  it("shows the ratio, Garmin's status and the healthy band", () => {
    const training = [testTraining({ local_date: TODAY, acwr: 1.3, acute_load: 237, chronic_load: 180, status: "PRODUCTIVE" })];
    const v = loadRatio.compute(testDashboardData({ training }))!;
    expect(v).toMatchObject({ value: 1.3, deltaText: "Productive", sub: "Acute 237 · chronic 180 · healthy 0.8–1.5" });
    expect(v.points![0]).toMatchObject({ low: 0.8, high: 1.5 });
  });

  it("is empty when Garmin's ratio is stale", () => {
    expect(loadRatio.compute(testDashboardData({ training: [testTraining({ local_date: addDays(TODAY, -5), acwr: 1 })] }))).toBeNull();
  });
});

describe("race5k", () => {
  it("is the latest prediction, faster than a month ago is good, drawn with faster up", () => {
    const training = [testTraining({ local_date: addDays(TODAY, -35), race_5k_s: 1900 }), testTraining({ local_date: TODAY, race_5k_s: 1738 })];
    const v = race5k.compute(testDashboardData({ training }))!;
    expect(race5k.format(v)).toEqual({ primary: "28:58", delta: "−2:42", tone: "good" });
    expect(v.invert).toBe(true);
  });
});
