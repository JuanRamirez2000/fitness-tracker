import { describe, expect, it } from "vitest";
import { mix, parseHex } from "@/lib/color";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import { COLOR_BLIND_PALETTE, DEFAULT_PALETTE } from "@/lib/theme/palette";
import { CELL_FLAT, CELL_NO_DATA, CELL_WARMING_UP } from "./colors";
import { WEIGHT_RULES, weightCell, weightDelta } from "./weight-rules";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";

function trend(over: Partial<WeightTrendRow> & { weight_lb: number }): WeightTrendRow {
  return {
    user_id: USER,
    local_date: "2026-09-18",
    avg7_lb: over.weight_lb,
    n7: 7,
    raw_delta_lb: null,
    avg7_delta_lb: null,
    ...over,
  };
}

// A 200 lb previous day makes percentages easy: 1 lb is 0.5%.
const PREVIOUS = trend({ local_date: "2026-09-17", weight_lb: 200, avg7_lb: 200 });

describe("WEIGHT_RULES", () => {
  it("keeps the starting constants from the brief", () => {
    expect(WEIGHT_RULES.raw).toEqual({ capPct: 1.0, deadPct: 0.15 });
    expect(WEIGHT_RULES.avg7).toEqual({ capPct: 0.15, deadPct: 0.02 });
  });
});

describe("weightDelta", () => {
  it("is the signed change as a percent of the previous recorded value", () => {
    const row = trend({ weight_lb: 199, raw_delta_lb: -1 });
    expect(weightDelta("raw", row, PREVIOUS)).toEqual({ deltaLb: -1, pct: -0.5 });
  });

  it("uses the 7-day average and its own previous value in avg7 mode", () => {
    const previous = trend({ weight_lb: 210, avg7_lb: 200 });
    const row = trend({ weight_lb: 190, avg7_lb: 199.8, avg7_delta_lb: -0.2 });
    expect(weightDelta("avg7", row, previous)?.pct).toBeCloseTo(-0.1, 10);
  });

  it("is null for the first ever weigh-in", () => {
    expect(weightDelta("raw", trend({ weight_lb: 232.4 }), null)).toBeNull();
    expect(weightDelta("raw", trend({ weight_lb: 232.4, raw_delta_lb: null }), PREVIOUS)).toBeNull();
  });
});

describe("weightCell (raw mode)", () => {
  const cell = (deltaLb: number, palette = DEFAULT_PALETTE) =>
    weightCell(
      "raw",
      trend({ weight_lb: 200 + deltaLb, raw_delta_lb: deltaLb }),
      PREVIOUS,
      palette,
    );

  it("is no data when there is no weigh-in that day", () => {
    expect(weightCell("raw", undefined, PREVIOUS, DEFAULT_PALETTE)).toEqual({
      state: "none",
      fill: null,
    });
  });

  it("is grey for the first ever weigh-in", () => {
    expect(weightCell("raw", trend({ weight_lb: 232.4 }), null, DEFAULT_PALETTE)).toEqual({
      state: "data",
      fill: CELL_NO_DATA,
    });
  });

  it("is neutral inside the dead zone, in either direction", () => {
    // 0.29 lb on 200 is 0.145%, just under the 0.15% dead zone.
    expect(cell(0.29).fill).toBe(CELL_FLAT);
    expect(cell(-0.29).fill).toBe(CELL_FLAT);
    expect(cell(0).fill).toBe(CELL_FLAT);
  });

  it("goes down = good hue and up = bad hue once outside the dead zone", () => {
    expect(cell(-0.31).fill).not.toBe(CELL_FLAT);
    const down = parseHex(cell(-0.6).fill ?? "");
    const up = parseHex(cell(0.6).fill ?? "");
    expect(down[1]).toBeGreaterThan(down[0]); // green channel leads
    expect(up[0]).toBeGreaterThan(up[1]); // red channel leads
  });

  it("starts at 25% intensity just past the dead zone", () => {
    // 0.301 lb is 0.1505%, about 0.0005% over the dead zone, so t is ~0.
    expect(cell(-0.301).fill).toBe(mix(CELL_FLAT, DEFAULT_PALETTE.good, 0.25));
  });

  it("follows the ramp between the dead zone and the cap", () => {
    // -1 lb on 200 is 0.5%: t = (0.5 - 0.15) / (1.0 - 0.15).
    const t = (0.5 - 0.15) / (1.0 - 0.15);
    expect(cell(-1).fill).toBe(mix(CELL_FLAT, DEFAULT_PALETTE.good, 0.25 + 0.75 * t));
  });

  it("saturates at the cap and stays there", () => {
    expect(cell(-2).fill).toBe(DEFAULT_PALETTE.good); // exactly 1.0%
    expect(cell(-8).fill).toBe(DEFAULT_PALETTE.good);
    expect(cell(2).fill).toBe(DEFAULT_PALETTE.bad);
    expect(cell(8).fill).toBe(DEFAULT_PALETTE.bad);
  });

  it("gets steadily stronger as the change grows", () => {
    const reds = [0.4, 0.8, 1.2, 1.6, 2.0].map((lb) => parseHex(cell(lb).fill ?? "")[0]);
    for (let i = 1; i < reds.length; i++) expect(reds[i]).toBeGreaterThan(reds[i - 1]);
  });

  it("uses the color-blind hues when that palette is active", () => {
    expect(cell(-2, COLOR_BLIND_PALETTE).fill).toBe(COLOR_BLIND_PALETTE.good);
    expect(cell(2, COLOR_BLIND_PALETTE).fill).toBe(COLOR_BLIND_PALETTE.bad);
  });

  it("ignores how few weigh-ins the average has", () => {
    const row = trend({ weight_lb: 198, raw_delta_lb: -2, n7: 1 });
    expect(weightCell("raw", row, PREVIOUS, DEFAULT_PALETTE).state).toBe("data");
  });
});

describe("weightCell (7-day average mode)", () => {
  const cell = (n7: number, avg7DeltaLb: number) =>
    weightCell(
      "avg7",
      trend({ weight_lb: 190, avg7_lb: 200 + avg7DeltaLb, avg7_delta_lb: avg7DeltaLb, n7 }),
      PREVIOUS,
      DEFAULT_PALETTE,
    );

  it("is warming up until 3 weigh-ins are in the window, whatever the change", () => {
    expect(cell(1, -5)).toEqual({ state: "warming_up", fill: CELL_WARMING_UP });
    expect(cell(2, -5)).toEqual({ state: "warming_up", fill: CELL_WARMING_UP });
    expect(cell(3, -5).state).toBe("data");
  });

  it("uses its own, much tighter, thresholds", () => {
    // 0.01 lb on 200 is 0.005%: neutral. 0.2 lb is 0.1%: 0.15 cap is not reached yet.
    expect(cell(7, -0.01).fill).toBe(CELL_FLAT);
    const t = (0.1 - 0.02) / (0.15 - 0.02);
    expect(cell(7, -0.2).fill).toBe(mix(CELL_FLAT, DEFAULT_PALETTE.good, 0.25 + 0.75 * t));
  });

  it("saturates at 0.15%", () => {
    expect(cell(7, -0.3).fill).toBe(DEFAULT_PALETTE.good);
    expect(cell(7, 0.3).fill).toBe(DEFAULT_PALETTE.bad);
  });

  it("colors the same change differently from raw mode", () => {
    const row = trend({ weight_lb: 199, raw_delta_lb: -1, avg7_lb: 199.8, avg7_delta_lb: -0.2 });
    const raw = weightCell("raw", row, PREVIOUS, DEFAULT_PALETTE).fill;
    const avg = weightCell("avg7", row, PREVIOUS, DEFAULT_PALETTE).fill;
    expect(raw).not.toBe(avg);
  });
});
