import { describe, expect, it } from "vitest";
import { resolveCardTier } from "./footprint";

describe("resolveCardTier", () => {
  it("1x1 shows only the value, no visuals", () => {
    expect(resolveCardTier({ w: 1, h: 1 })).toEqual({
      valueSize: 22,
      unitSize: 11,
      showDelta: false,
      showSub: false,
      showVisual: false,
      showSparkline: false,
      sparklineHeight: 0,
      progressBarHeight: 6,
    });
  });

  it("2x1 (wide, short) shows delta and sub but no visual — not tall enough for a chart", () => {
    expect(resolveCardTier({ w: 2, h: 1 })).toMatchObject({ showDelta: true, showSub: true, showVisual: false, showSparkline: false, sparklineHeight: 0 });
  });

  it("1x2 (narrow, tall) shows both visuals, sized smaller than 2x2's", () => {
    const tier = resolveCardTier({ w: 1, h: 2 });
    expect(tier).toMatchObject({ showDelta: true, showSub: true, showVisual: true, showSparkline: true });
    expect(tier.sparklineHeight).toBeGreaterThan(0);
  });

  it("2x2 shows everything, with the tallest sparkline and progress bar", () => {
    const tier = resolveCardTier({ w: 2, h: 2 });
    expect(tier).toMatchObject({ valueSize: 44, unitSize: 14, showDelta: true, showSub: true, showVisual: true, showSparkline: true });
    const narrow = resolveCardTier({ w: 1, h: 2 });
    expect(tier.sparklineHeight).toBeGreaterThan(narrow.sparklineHeight);
    expect(tier.progressBarHeight).toBeGreaterThan(narrow.progressBarHeight);
  });
});
