import { describe, expect, it } from "vitest";
import { resolveCardTier } from "./footprint";

describe("resolveCardTier", () => {
  it("1x1 shows only the value", () => {
    expect(resolveCardTier({ w: 1, h: 1 })).toEqual({
      valueSize: 22,
      unitSize: 11,
      showDelta: false,
      showSub: false,
      showVisual: false,
      showSparkline: false,
    });
  });

  it("2x1 (wide, short) shows delta and sub but no visual", () => {
    expect(resolveCardTier({ w: 2, h: 1 })).toMatchObject({ showDelta: true, showSub: true, showVisual: false, showSparkline: false });
  });

  it("1x2 (narrow, tall) shows a progress-capable visual but no sparkline", () => {
    expect(resolveCardTier({ w: 1, h: 2 })).toMatchObject({ showDelta: true, showSub: true, showVisual: true, showSparkline: false });
  });

  it("2x2 shows everything including the sparkline", () => {
    expect(resolveCardTier({ w: 2, h: 2 })).toMatchObject({
      valueSize: 44,
      unitSize: 14,
      showDelta: true,
      showSub: true,
      showVisual: true,
      showSparkline: true,
    });
  });
});
