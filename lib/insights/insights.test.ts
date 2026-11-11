import { describe, expect, it } from "vitest";
import { testDashboardData, testProfile, testRide, testTraining, trendRow } from "@/lib/kpis/testing";
import { testNight, testRecovery } from "@/lib/today/testing";
import { buildDailyInsights, hrvInsight, readyBy, recoveryInsight, restingHrInsight, sleepInsight, splitFactors } from "./daily";
import { climbGainPct, muscleInsight, paceInsight, powerToWeightInsight } from "./weight";

const TODAY = "2026-11-11";
const TZ = "America/Los_Angeles";
const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;

describe("sleepInsight", () => {
  it("calls sleep the weak spot after a week well short of need", () => {
    const sleep = [5, 6, 7, 8, 9, 10, 11].map((n) => testNight({ local_date: day(n), duration_s: 6 * 3600, need_s: 7 * 3600 }));
    const insight = sleepInsight({ recovery: [], sleep, today: TODAY, profile: { timezone: TZ } })!;
    expect(insight.tone).toBe("act");
    expect(insight.headline).toBe("Sleep is your weak spot");
    expect(insight.lever).toMatch(/an hour earlier/);
    expect(insight.numbers.find((n) => n.label === "Last 7 nights")!.value).toBe("7.0 h short");
  });

  it("is on track when sleep meets need", () => {
    const sleep = [testNight({ local_date: TODAY, duration_s: 7.5 * 3600, need_s: 7 * 3600 })];
    expect(sleepInsight({ recovery: [], sleep, today: TODAY, profile: { timezone: TZ } })!.tone).toBe("good");
  });
});

describe("hrvInsight", () => {
  const night = (hrv_ms: number) => testRecovery({ local_date: TODAY, hrv_ms, hrv_baseline_low: 40, hrv_baseline_high: 49 });
  it("reads below the normal range as strain, inside it as absorbing training", () => {
    expect(hrvInsight({ recovery: [night(35)], sleep: [], today: TODAY, profile: { timezone: TZ } })!.tone).toBe("act");
    expect(hrvInsight({ recovery: [night(45)], sleep: [], today: TODAY, profile: { timezone: TZ } })!.headline).toBe("Your body is absorbing training well");
  });
  it("never puts milliseconds in the words", () => {
    const i = hrvInsight({ recovery: [night(35)], sleep: [], today: TODAY, profile: { timezone: TZ } })!;
    expect(`${i.headline} ${i.effect} ${i.lever}`).not.toMatch(/ms\b/);
  });
});

describe("restingHrInsight", () => {
  it("flags a morning well above the 30-day normal", () => {
    const recovery = [...Array.from({ length: 20 }, (_, i) => testRecovery({ local_date: `2026-10-${String(i + 10).padStart(2, "0")}`, resting_hr: 51 })), testRecovery({ local_date: TODAY, resting_hr: 58 })];
    const i = restingHrInsight({ recovery, sleep: [], today: TODAY, profile: { timezone: TZ } })!;
    expect(i.tone).toBe("act");
    expect(i.effect).toMatch(/7 beats/);
  });
});

describe("readyBy / recoveryInsight", () => {
  const now = new Date("2026-11-11T18:00:00Z"); // 10 am Pacific
  it("gives the clock time recovery runs out, with the weekday when it isn't today", () => {
    expect(readyBy({ recovery_hours: 6, readiness_at: "2026-11-11T17:00:00Z" }, TZ, now)).toEqual({ ready: false, label: "3:00 pm" });
    expect(readyBy({ recovery_hours: 30, readiness_at: "2026-11-11T17:00:00Z" }, TZ, now)!.label).toMatch(/^Thu /);
    expect(readyBy({ recovery_hours: 0, readiness_at: "2026-11-11T17:00:00Z" }, TZ, now)).toEqual({ ready: true, label: "Now" });
  });
  it("says ready for a hard session once the clock has run out", () => {
    const recovery = [testRecovery({ local_date: TODAY, readiness_score: 80, readiness_at: "2026-11-11T15:00:00Z", recovery_hours: 1 })];
    expect(recoveryInsight({ recovery, sleep: [], today: TODAY, profile: { timezone: TZ } }, now)!.headline).toBe("Ready for a hard session");
  });
});

describe("buildDailyInsights", () => {
  it("returns only the insights that have data", () => {
    expect(buildDailyInsights({ recovery: [], sleep: [], today: TODAY, profile: { timezone: TZ } })).toEqual([]);
  });

  it("leaves out data too old to describe this morning", () => {
    const sleep = [testNight({ local_date: day(3) })];
    const recovery = [testRecovery({ local_date: day(3), hrv_ms: 45, hrv_baseline_low: 40, hrv_baseline_high: 49, readiness_score: 70 })];
    expect(buildDailyInsights({ recovery, sleep, today: TODAY, profile: { timezone: TZ } })).toEqual([]);
  });

  it("never suggests moving bedtime by more than an hour", () => {
    const sleep = [5, 6, 7, 8, 9, 10, 11].map((n) => testNight({ local_date: day(n), duration_s: 4 * 3600, need_s: 8 * 3600 }));
    expect(sleepInsight({ recovery: [], sleep, today: TODAY, profile: { timezone: TZ } })!.lever).toMatch(/an hour earlier/);
  });
});

describe("splitFactors", () => {
  it("puts Good factors under helping and the rest under holding back, weakest first", () => {
    const { helping, holding } = splitFactors([
      { key: "hrv", label: "HRV", percent: 92, state: "good" },
      { key: "sleep", label: "Sleep", percent: 70, state: "fair" },
      { key: "recovery_time", label: "Recovery time", percent: 40, state: "low" },
    ]);
    expect(helping.map((p) => p.text)).toEqual(["HRV in its normal range"]);
    expect(holding.map((p) => p.text)).toEqual(["Still recovering from recent workouts", "A short or restless night"]);
  });
});

describe("weight insights", () => {
  const profile = testProfile({ start_weight_lb: 288, goal_weight_lb: 200, goal_pace_lb_per_week: 1, program_start_date: "2026-09-10" });
  const weightTrend = [
    trendRow({ local_date: "2026-10-12", weight_lb: 274, avg7_lb: 273.5 }),
    trendRow({ local_date: "2026-11-04", weight_lb: 272, avg7_lb: 272.4 }),
    trendRow({ local_date: TODAY, weight_lb: 264.8, avg7_lb: 267.2 }),
  ];
  const base = testDashboardData({ today: TODAY, profile, weightTrend, bodyComposition: [], activities: [], training: [] });

  it("flags a week well ahead of the planned pace", () => {
    const i = paceInsight(base)!;
    expect(i.tone).toBe("act");
    expect(i.effect).toMatch(/5 pounds/);
    expect(i.effect).toMatch(/5 times your plan/);
  });

  it("puts the loss so far as a climbing gain at the same power", () => {
    expect(climbGainPct(288, 267.2)).toBeCloseTo((1 - 289.2 / 310) * 100, 6);
    const i = powerToWeightInsight(base)!;
    expect(i.headline).toBe("Climbs are about 7% faster than at your start weight");
  });

  it("works watts per kilo from the rides when Garmin's FTP is implausible", () => {
    const data = { ...base, activities: [testRide({ local_date: day(8), max_20min_power_w: 138 })], training: [testTraining({ local_date: day(1), ftp_w: 333 })] };
    const wkg = powerToWeightInsight(data)!.numbers.find((n) => n.label === "Power to weight")!.value;
    expect(wkg).toMatch(/at 131 W \(from your best 20 min\)/);
  });

  it("gives one muscle verdict from the month's composition, numbers kept to the fold", () => {
    const comp = (local_date: string, weight_lb: number, body_fat_pct: number) => ({ local_date, weight_lb, body_fat_pct, muscle_mass_lb: 98, bone_mass_lb: 16, body_water_pct: 48 });
    const data = { ...base, bodyComposition: [comp("2026-10-12", 274, 34.5), comp(TODAY, 266.5, 34.4)] };
    const i = muscleInsight(data)!;
    expect(i.tone).toBe("act");
    expect(`${i.headline} ${i.effect}`).not.toMatch(/\d+(\.\d+)? ?lb/);
  });
});
