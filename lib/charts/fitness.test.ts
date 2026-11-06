import { describe, expect, it } from "vitest";
import type { DateRange } from "@/lib/dashboard/types";
import { testTraining } from "@/lib/kpis/testing";
import { buildFitness, buildRacePredictions, fmtRaceChange, fmtRaceTime, racePaceSec, rankFactors } from "./fitness";

const MONTH: DateRange = { key: "month", from: "2026-10-04", to: "2026-11-03" };

/** Garmin's fitness age components on Nov 3 (lib/garmin/fixtures/fitness-age.json). */
const COMPONENTS = {
  bodyFat: { value: 33.8, targetValue: 14.2, potentialAge: 18, priority: 1 },
  vigorousDaysAvg: { value: 2, targetValue: 3, potentialAge: 27.6, priority: 3 },
  rhr: { value: 52 },
  vigorousMinutesAvg: { value: 65.5, targetValue: 75, potentialAge: 27.6, priority: 2 },
};

describe("rankFactors", () => {
  it("orders by Garmin's priority and tags the largest lever", () => {
    expect(rankFactors(COMPONENTS).map((f) => [f.label, f.value, f.target, f.tag])).toEqual([
      ["Body fat", "33.8%", "14.2%", "largest lever"],
      ["Vigorous minutes a week", "66 min", "75 min", "lever"],
      ["Vigorous days a week", "2 days", "3 days", "lever"],
      ["Resting HR", "52 bpm", null, "context"],
    ]);
  });

  it("says when a factor already meets its target", () => {
    const [f] = rankFactors({ vigorousDaysAvg: { value: 4, targetValue: 3, priority: 2 } });
    expect(f.tag).toBe("on target");
  });

  it("is empty without components", () => {
    expect(rankFactors(null)).toEqual([]);
  });
});

describe("buildFitness", () => {
  const training = [
    testTraining({ local_date: "2026-09-20", vo2max: 40.5 }), // before the range: latest-only context
    testTraining({ local_date: "2026-10-10", vo2max: 41.2, fitness_age: 28, chronological_age: 26, fitness_age_achievable: 18 }),
    testTraining({ local_date: "2026-11-03", vo2max: 42.2, fitness_age: 27.1, chronological_age: 26, fitness_age_achievable: 18, fitness_age_factors: COMPONENTS }),
  ];

  it("reads VO2 max and fitness age in range, with the latest factors", () => {
    const f = buildFitness({ training, dateRange: MONTH, today: "2026-11-03" })!;
    expect(f.vo2.map((p) => p.value)).toEqual([41.2, 42.2]);
    expect(f.vo2Latest).toBe(42.2);
    expect(f.vo2Delta).toBeCloseTo(1, 6);
    expect(f).toMatchObject({ fitnessAgeLatest: 27.1, realAge: 26, achievableAge: 18 });
    expect(f.factors[0].tag).toBe("largest lever");
  });

  it("is null with neither series in range", () => {
    expect(buildFitness({ training: training.slice(0, 1), dateRange: MONTH, today: "2026-11-03" })).toBeNull();
  });
});

describe("race predictions", () => {
  it("reports each distance's latest time and its change over the range", () => {
    const training = [
      testTraining({ local_date: "2026-10-04", race_5k_s: 1824, race_10k_s: 3990, race_half_s: 9100 }),
      testTraining({ local_date: "2026-11-03", race_5k_s: 1753, race_10k_s: 3837, race_half_s: 8935 }),
    ];
    const races = buildRacePredictions({ training, dateRange: MONTH, today: "2026-11-03" });
    expect(races.map((r) => [r.label, r.latest, r.change])).toEqual([
      ["5K", 1753, -71],
      ["10K", 3837, -153],
      ["Half marathon", 8935, -165],
    ]);
  });

  it("keeps every day's prediction in range, oldest first, for the chart", () => {
    const training = [
      testTraining({ local_date: "2026-10-04", race_5k_s: 1824 }),
      testTraining({ local_date: "2026-10-20", race_5k_s: 1800 }),
      testTraining({ local_date: "2026-11-03", race_5k_s: 1753 }),
      testTraining({ local_date: "2026-11-09", race_5k_s: 1700 }), // after today: not yet
    ];
    const [fiveK] = buildRacePredictions({ training, dateRange: MONTH, today: "2026-11-03" });
    expect(fiveK.points.map((p) => p.date)).toEqual(["2026-10-04", "2026-10-20", "2026-11-03"]);
    expect(fiveK.miles).toBeCloseTo(3.107, 3);
  });

  it("turns a predicted time into a pace per mile", () => {
    expect(Math.round(racePaceSec(1753, 3.10686))).toBe(564); // 9:24
  });

  it("formats times and changes like a race clock", () => {
    expect(fmtRaceTime(1753)).toBe("29:13");
    expect(fmtRaceTime(3837)).toBe("1:03:57");
    expect(fmtRaceChange(-71)).toBe("▼ 1:11 faster");
    expect(fmtRaceChange(30)).toBe("▲ 0:30 slower");
    expect(fmtRaceChange(0)).toBe("● no change");
  });
});
