import { describe, expect, it } from "vitest";
import { contrastRatio, mix, parseHex, relativeLuminance } from "./color";

describe("parseHex", () => {
  it("reads #rrggbb in either case", () => {
    expect(parseHex("#7FB2ff")).toEqual([127, 178, 255]);
  });

  it("rejects anything else", () => {
    expect(() => parseHex("#fff")).toThrow();
    expect(() => parseHex("7fb2ff")).toThrow();
  });
});

describe("mix", () => {
  it("returns the endpoints at t = 0 and t = 1", () => {
    expect(mix("#39424c", "#4fb783", 0)).toBe("#39424c");
    expect(mix("#39424c", "#4fb783", 1)).toBe("#4fb783");
  });

  it("blends per channel and rounds", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("contrast", () => {
  it("has the WCAG anchor values", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#7fb2ff", "#7fb2ff")).toBe(1);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#12161b", "#e6e9ee")).toBe(contrastRatio("#e6e9ee", "#12161b"));
  });
});
