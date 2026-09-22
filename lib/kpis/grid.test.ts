import { describe, expect, it } from "vitest";
import { emptySlotCount, GRID_COLUMNS, kpiSpan } from "./grid";

describe("kpiSpan", () => {
  it("is 2 for the hero card and 1 otherwise", () => {
    expect(kpiSpan({ hero: true })).toBe(2);
    expect(kpiSpan({ hero: false })).toBe(1);
    expect(kpiSpan({})).toBe(1);
  });
});

describe("emptySlotCount", () => {
  it("is 0 for an empty registry (nothing to pad)", () => {
    expect(emptySlotCount([])).toBe(0);
  });

  it("pads the brief's 8-KPI set (hero=2 + 7x1 = 9 columns) to exactly one open slot", () => {
    const eight = [{ hero: true }, {}, {}, {}, {}, {}, {}, {}];
    expect(emptySlotCount(eight)).toBe(1);
    expect(GRID_COLUMNS * 2 - (2 + 7)).toBe(1); // sanity: two 5-col rows, 9 used, 1 left
  });

  it("is 0 when the configured KPIs exactly fill whole rows", () => {
    expect(emptySlotCount([{}, {}, {}, {}, {}])).toBe(0); // one full row
    expect(emptySlotCount([{ hero: true }, {}, {}, {}])).toBe(0); // 2+1+1+1 = 5
  });

  it("pads a partial row for a non-default column count too", () => {
    expect(emptySlotCount([{}, {}], 4)).toBe(2);
  });
});
