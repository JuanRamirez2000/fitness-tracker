import { describe, expect, it } from "vitest";
import { mix, parseHex } from "@/lib/color";
import { COLOR_BLIND_PALETTE, DEFAULT_PALETTE } from "@/lib/theme/palette";
import { CELL_NO_DATA, CELL_STEPS_FLOOR } from "./colors";
import { activityPaint, caloriesPaint, loggedPaint, loggedState, stepsPaint } from "./paints";

describe("caloriesPaint", () => {
  it("maps accurate, uncertain and missed to green, amber and coral", () => {
    expect(caloriesPaint("accurate", DEFAULT_PALETTE)).toEqual({ fill: DEFAULT_PALETTE.good });
    expect(caloriesPaint("uncertain", DEFAULT_PALETTE)).toEqual({ fill: DEFAULT_PALETTE.warn });
    expect(caloriesPaint("missed", DEFAULT_PALETTE)).toEqual({ fill: DEFAULT_PALETTE.missed });
  });

  it("treats no row as no data, which is not the same as missed", () => {
    expect(caloriesPaint(undefined, DEFAULT_PALETTE)).toBeNull();
    expect(caloriesPaint("missed", DEFAULT_PALETTE)).not.toBeNull();
  });

  it("follows the color-blind palette", () => {
    expect(caloriesPaint("accurate", COLOR_BLIND_PALETTE)?.fill).toBe(COLOR_BLIND_PALETTE.good);
    expect(caloriesPaint("missed", COLOR_BLIND_PALETTE)?.fill).toBe(COLOR_BLIND_PALETTE.missed);
  });
});

describe("stepsPaint", () => {
  const goal = 10000;

  it("is no data without a row", () => {
    expect(stepsPaint(undefined, goal, DEFAULT_PALETTE)).toBeNull();
  });

  it("keeps a recorded zero distinct from no data", () => {
    expect(stepsPaint(0, goal, DEFAULT_PALETTE)).toEqual({ fill: CELL_STEPS_FLOOR });
    expect(CELL_STEPS_FLOOR).not.toBe(CELL_NO_DATA);
  });

  it("scales with steps against the goal", () => {
    expect(stepsPaint(5000, goal, DEFAULT_PALETTE)?.fill).toBe(
      mix(CELL_STEPS_FLOOR, DEFAULT_PALETTE.accent, 0.5),
    );
  });

  it("is full intensity at and above the goal", () => {
    expect(stepsPaint(10000, goal, DEFAULT_PALETTE)?.fill).toBe(DEFAULT_PALETTE.accent);
    expect(stepsPaint(23000, goal, DEFAULT_PALETTE)?.fill).toBe(DEFAULT_PALETTE.accent);
  });

  it("moves when the goal moves", () => {
    const at8k = (g: number) => parseHex(stepsPaint(8000, g, DEFAULT_PALETTE)?.fill ?? "")[2];
    expect(at8k(8000)).toBeGreaterThan(at8k(12000));
  });

  it("does not divide by a zero goal", () => {
    expect(stepsPaint(4000, 0, DEFAULT_PALETTE)?.fill).toBe(DEFAULT_PALETTE.accent);
  });
});

describe("activityPaint", () => {
  it("is no data with no activities", () => {
    expect(activityPaint([])).toBeNull();
  });

  it("uses the type color for one activity", () => {
    expect(activityPaint(["#F97316"])).toEqual({ fill: "#F97316" });
  });

  it("switches to the split-and-notch 'multiple' style for two or more, using the first two", () => {
    expect(activityPaint(["#F97316", "#A855F7"])).toEqual({
      fill: "#F97316",
      secondFill: "#A855F7",
      notch: true,
    });
    expect(activityPaint(["#F97316", "#A855F7", "#14B8A6"])?.secondFill).toBe("#A855F7");
  });

  it("still marks two sessions of the same type as multiple", () => {
    expect(activityPaint(["#F97316", "#F97316"])?.notch).toBe(true);
  });
});

describe("logged", () => {
  it("names the four states from weight (primary) and steps (secondary)", () => {
    expect(loggedState(false, false)).toBe("none");
    expect(loggedState(false, true)).toBe("steps_only");
    expect(loggedState(true, false)).toBe("weight_only");
    expect(loggedState(true, true)).toBe("weight_steps");
  });

  it("paints four distinct states, with weight stronger than steps", () => {
    const paints = (["none", "steps_only", "weight_only", "weight_steps"] as const).map((s) =>
      loggedPaint(s, DEFAULT_PALETTE),
    );
    expect(paints[0]).toBeNull();
    const fills = paints.slice(1).map((p) => p?.fill);
    expect(new Set(fills).size).toBe(3);

    const strength = (fill: string | undefined) => parseHex(fill ?? "")[2];
    expect(strength(fills[1])).toBeGreaterThan(strength(fills[0]));
    expect(strength(fills[2])).toBeGreaterThan(strength(fills[1]));
  });

  it("gives weight plus steps the corner notch at full accent", () => {
    expect(loggedPaint("weight_steps", DEFAULT_PALETTE)).toEqual({
      fill: DEFAULT_PALETTE.accent,
      notch: true,
    });
    expect(loggedPaint("weight_only", DEFAULT_PALETTE)?.notch).toBeUndefined();
  });
});
