import { describe, expect, it } from "vitest";
import {
  defaultDashboardLayout,
  findOpenSlot,
  GRID_COLS,
  GRID_ROWS,
  hiddenItemsOf,
  mergeRglPositions,
  orderForMobile,
  visibleItems,
  withItemHidden,
  withItemShown,
  type WidgetLayoutItem,
} from "./widget-layout";

function item(over: Partial<WidgetLayoutItem> = {}): WidgetLayoutItem {
  return { i: "a", x: 0, y: 0, w: 1, h: 1, hidden: false, ...over };
}

describe("findOpenSlot", () => {
  it("returns the top-left cell on an empty grid", () => {
    expect(findOpenSlot([], { w: 1, h: 1 })).toEqual({ x: 0, y: 0 });
  });

  it("skips over an occupied cell to the next free one", () => {
    const occupied = [item({ x: 0, y: 0, w: 1, h: 1 })];
    expect(findOpenSlot(occupied, { w: 1, h: 1 })).toEqual({ x: 1, y: 0 });
  });

  it("wraps to the next row once the current row has no room for the footprint", () => {
    const occupied = Array.from({ length: GRID_COLS }, (_, x) => item({ x, y: 0, w: 1, h: 1 }));
    expect(findOpenSlot(occupied, { w: 1, h: 1 })).toEqual({ x: 0, y: 1 });
  });

  it("finds a 2x2 slot that clears a partially-occupied row", () => {
    const occupied = [item({ x: 0, y: 0, w: 1, h: 1 })];
    // (0,0) is taken; a 2x2 needs two full columns and two full rows, so it lands at x=1.
    expect(findOpenSlot(occupied, { w: 2, h: 2 })).toEqual({ x: 1, y: 0 });
  });

  it("returns null once the whole grid is full", () => {
    const occupied: WidgetLayoutItem[] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) occupied.push(item({ i: `${x}-${y}`, x, y, w: 1, h: 1 }));
    }
    expect(findOpenSlot(occupied, { w: 1, h: 1 })).toBeNull();
  });
});

describe("visibleItems / hiddenItemsOf", () => {
  it("partitions by the hidden flag", () => {
    const layout = [item({ i: "a", hidden: false }), item({ i: "b", hidden: true })];
    expect(visibleItems(layout).map((i) => i.i)).toEqual(["a"]);
    expect(hiddenItemsOf(layout).map((i) => i.i)).toEqual(["b"]);
  });
});

describe("orderForMobile", () => {
  it("sorts visible items by reading order (row then column), excluding hidden ones", () => {
    const layout = [
      item({ i: "bottom-right", x: 5, y: 2, hidden: false }),
      item({ i: "hidden", x: 0, y: 0, hidden: true }),
      item({ i: "top-left", x: 0, y: 0, hidden: false }),
      item({ i: "top-right", x: 3, y: 0, hidden: false }),
    ];
    expect(orderForMobile(layout).map((i) => i.i)).toEqual(["top-left", "top-right", "bottom-right"]);
  });
});

describe("withItemHidden / withItemShown", () => {
  it("hiding then showing round-trips back onto the grid at an open slot", () => {
    const layout = [item({ i: "a", x: 0, y: 0 }), item({ i: "b", x: 1, y: 0 })];
    const hidden = withItemHidden(layout, "b");
    expect(hidden.find((i) => i.i === "b")).toMatchObject({ hidden: true });

    const shown = withItemShown(hidden, "b", { w: 1, h: 1 });
    const restored = shown.find((i) => i.i === "b")!;
    expect(restored.hidden).toBe(false);
    // "a" still occupies (0,0), so "b" lands at the next open cell, not back at its old spot.
    expect(restored).toMatchObject({ x: 1, y: 0 });
  });

  it("stays hidden if its footprint doesn't fit the room the grid has left", () => {
    const full: WidgetLayoutItem[] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) full.push(item({ i: `${x}-${y}`, x, y, hidden: false }));
    }
    // Hiding one 1x1 widget frees exactly one cell — not enough room for a 2x2 comeback.
    const hidden = withItemHidden(full, "0-0");
    const result = withItemShown(hidden, "0-0", { w: 2, h: 2 });
    expect(result.find((i) => i.i === "0-0")).toMatchObject({ hidden: true });
  });
});

describe("mergeRglPositions", () => {
  it("applies new positions from react-grid-layout to matching visible items", () => {
    const layout = [item({ i: "a", x: 0, y: 0, w: 1, h: 1 })];
    const merged = mergeRglPositions(layout, [{ i: "a", x: 3, y: 1, w: 2, h: 2 }]);
    expect(merged[0]).toMatchObject({ x: 3, y: 1, w: 2, h: 2 });
  });

  it("leaves hidden items (absent from the RGL layout) untouched", () => {
    const layout = [item({ i: "a", x: 0, y: 0 }), item({ i: "b", x: 5, y: 2, hidden: true })];
    const merged = mergeRglPositions(layout, [{ i: "a", x: 1, y: 1, w: 1, h: 1 }]);
    expect(merged.find((i) => i.i === "b")).toEqual(item({ i: "b", x: 5, y: 2, hidden: true }));
  });
});

describe("defaultDashboardLayout", () => {
  it("places a hero-sized widget first and fills the rest at their own footprints without overlap", () => {
    const widgets = [
      { id: "hero", defaultFootprint: { w: 2 as const, h: 2 as const } },
      { id: "a", defaultFootprint: { w: 1 as const, h: 1 as const } },
      { id: "b", defaultFootprint: { w: 1 as const, h: 1 as const } },
    ];
    const layout = defaultDashboardLayout(widgets);
    expect(layout.find((i) => i.i === "hero")).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
    const [a, b] = [layout.find((i) => i.i === "a")!, layout.find((i) => i.i === "b")!];
    expect(a).not.toEqual(b);
    // No two widgets occupy overlapping cells.
    for (const x of layout) {
      for (const y of layout) {
        if (x.i !== y.i) expect(x.x < y.x + y.w && y.x < x.x + x.w && x.y < y.y + y.h && y.y < x.y + x.h).toBe(false);
      }
    }
  });
});
