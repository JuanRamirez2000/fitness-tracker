import { describe, expect, it } from "vitest";
import type { DateRange } from "@/lib/dashboard/types";
import type { BodyCompositionDay } from "@/lib/data/weigh-ins";
import { buildBodyMass, buildComposition, fatMassLb, leanMassLb } from "./body-composition";

/** The Nov 3 Index reading (lib/garmin/fixtures/weight-range.json), unless overridden. */
function day(over: Partial<BodyCompositionDay> & { local_date: string }): BodyCompositionDay {
  return { weight_lb: 272.4, body_fat_pct: 33.9, muscle_mass_lb: 99.58, bone_mass_lb: 16.75, body_water_pct: 48.3, ...over };
}

const MONTH: DateRange = { key: "month", from: "2026-10-04", to: "2026-11-03" };

describe("fat and lean mass", () => {
  it("derives fat mass from weight and percent, lean as the rest", () => {
    expect(fatMassLb({ weight_lb: 200, body_fat_pct: 30 })).toBe(60);
    expect(leanMassLb({ weight_lb: 200, body_fat_pct: 30 })).toBe(140);
  });
});

describe("buildBodyMass", () => {
  const history = [
    day({ local_date: "2026-09-02", weight_lb: 290, body_fat_pct: 36 }), // first scale reading
    day({ local_date: "2026-10-05", weight_lb: 280, body_fat_pct: 35 }),
    day({ local_date: "2026-11-03", weight_lb: 272.4, body_fat_pct: 33.9 }),
    day({ local_date: "2026-11-05", weight_lb: 270, body_fat_pct: 33 }), // after today: ignored
  ];

  it("reports range deltas and the change since the first scale reading", () => {
    const data = buildBodyMass({ bodyComposition: history, dateRange: MONTH, today: "2026-11-03" })!;
    expect(data.points.map((p) => p.date)).toEqual(["2026-10-05", "2026-11-03"]);
    expect(data.fatDelta).toBeCloseTo(272.4 * 0.339 - 98, 3);
    expect(data.since!.date).toBe("2026-09-02");
    expect(data.since!.weight).toBeCloseTo(-17.6, 3);
    expect(data.since!.fat).toBeCloseTo(272.4 * 0.339 - 104.4, 3);
    expect(data.since!.lean).toBeCloseTo(data.since!.weight - data.since!.fat, 3);
    // Most of the loss was fat.
    expect(data.since!.fatShareOfLoss).toBeCloseTo(data.since!.fat / data.since!.weight, 6);
    expect(data.since!.fatShareOfLoss!).toBeGreaterThan(0.5);
    expect(data.dataFrom).toBe("2026-10-05");
  });

  it("has no share of loss when weight went up, and no range delta from one reading", () => {
    const data = buildBodyMass({
      bodyComposition: [day({ local_date: "2026-10-01", weight_lb: 270 }), day({ local_date: "2026-11-03", weight_lb: 272 })],
      dateRange: { key: "week", from: "2026-10-28", to: "2026-11-03" },
      today: "2026-11-03",
    })!;
    expect(data.since!.fatShareOfLoss).toBeNull();
    expect(data.fatDelta).toBeNull();
  });

  it("is null with no reading in range", () => {
    expect(buildBodyMass({ bodyComposition: history.slice(0, 1), dateRange: MONTH, today: "2026-11-03" })).toBeNull();
  });
});

describe("buildComposition", () => {
  it("splits the latest reading into fat, muscle, bone and other that add up to the weight", () => {
    const c = buildComposition({ bodyComposition: [day({ local_date: "2026-11-03" })], today: "2026-11-03" })!;
    expect(c.segments.map((s) => s.part)).toEqual(["fat", "muscle", "bone", "other"]);
    expect(c.segments.reduce((sum, s) => sum + s.lb, 0)).toBeCloseTo(272.4, 6);
    expect(c.segments.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100, 6);
    expect(c.segments[0].pct).toBeCloseTo(33.9, 6);
    expect(c.waterPct).toBe(48.3);
  });

  it("folds unreported parts into other", () => {
    const c = buildComposition({
      bodyComposition: [day({ local_date: "2026-11-03", muscle_mass_lb: null, bone_mass_lb: null })],
      today: "2026-11-03",
    })!;
    expect(c.segments.map((s) => s.part)).toEqual(["fat", "other"]);
    expect(c.segments[1].lb).toBeCloseTo(272.4 * 0.661, 6);
  });

  it("is null before any scale reading", () => {
    expect(buildComposition({ bodyComposition: [], today: "2026-11-03" })).toBeNull();
  });
});
