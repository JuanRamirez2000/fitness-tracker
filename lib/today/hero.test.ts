import { describe, expect, it } from "vitest";
import { buildTodayHero, factorState, readinessBand, titleCase } from "./hero";
import { testNight, testRecovery } from "./testing";

// The design handoff's real values for Nov 2: readiness 58 Moderate after the run.
const NOV2 = testRecovery({
  local_date: "2026-11-02",
  readiness_score: 58,
  readiness_level: "MODERATE",
  readiness_factors: { sleep_history: 50, hrv: 100, recovery_time: 80, acwr: 87, stress_history: 87, sleep: 68 },
  readiness_at: "2026-11-03T00:50:36Z",
  readiness_morning_score: 68,
  recovery_hours: 12.6,
  body_battery_wake: 61,
});

describe("factorState", () => {
  it("uses Good >= 85, Fair 60 to 84, Low < 60", () => {
    expect(factorState(100)).toBe("good");
    expect(factorState(85)).toBe("good");
    expect(factorState(84)).toBe("fair");
    expect(factorState(60)).toBe("fair");
    expect(factorState(59)).toBe("low");
  });
});

describe("readinessBand", () => {
  it("follows Garmin's bands", () => {
    expect(readinessBand(85)).toBe("good");
    expect(readinessBand(75)).toBe("good");
    expect(readinessBand(58)).toBe("warn");
    expect(readinessBand(49)).toBe("bad");
  });
});

describe("titleCase", () => {
  it("turns Garmin's enum words into labels", () => {
    expect(titleCase("MODERATE")).toBe("Moderate");
    expect(titleCase("VERY_GOOD")).toBe("Very Good");
  });
});

describe("buildTodayHero", () => {
  it("reads readiness, factors in display order, recovery, last night and wake battery", () => {
    const hero = buildTodayHero({ today: "2026-11-02", recovery: [NOV2], sleep: [testNight({ local_date: "2026-11-02" })] });
    expect(hero.readiness).toMatchObject({ date: "2026-11-02", score: 58, label: "Moderate", band: "warn", morningScore: 68, recoveryHours: 12.6 });
    expect(hero.readiness!.factors.map((f) => [f.label, f.percent, f.state])).toEqual([
      ["Sleep history", 50, "low"],
      ["HRV", 100, "good"],
      ["Recovery time", 80, "fair"],
      ["Acute load ratio", 87, "good"],
      ["Stress history", 87, "good"],
      ["Sleep", 68, "fair"],
    ]);
    expect(hero.lastNight).toMatchObject({ date: "2026-11-02", hours: 7.5, score: 85 });
    expect(hero.lastNight!.needHours).toBeCloseTo(7.67, 2);
    expect(hero.batteryWake).toEqual({ date: "2026-11-02", value: 61 });
  });

  it("falls back to the latest earlier day for each part, never a future one", () => {
    const hero = buildTodayHero({
      today: "2026-11-03",
      recovery: [NOV2, testRecovery({ local_date: "2026-11-03", body_battery_wake: 80 }), testRecovery({ local_date: "2026-11-04", readiness_score: 90 })],
      sleep: [testNight({ local_date: "2026-11-02" })],
    });
    expect(hero.readiness?.date).toBe("2026-11-02");
    expect(hero.batteryWake).toEqual({ date: "2026-11-03", value: 80 });
    expect(hero.lastNight?.date).toBe("2026-11-02");
  });

  it("is empty without data", () => {
    expect(buildTodayHero({ today: "2026-11-03", recovery: [], sleep: [] })).toEqual({
      today: "2026-11-03",
      readiness: null,
      lastNight: null,
      batteryWake: null,
    });
  });
});
