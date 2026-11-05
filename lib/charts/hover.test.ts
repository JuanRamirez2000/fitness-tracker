import { describe, expect, it } from "vitest";
import { nearestIndex } from "./hover";

describe("nearestIndex", () => {
  it("finds the closest value", () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
    expect(nearestIndex([0, 10, 20, 30], -5)).toBe(0);
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3);
  });

  it("skips gaps", () => {
    expect(nearestIndex([null, 0, null, null, 30, null], 12)).toBe(1);
    expect(nearestIndex([null, 0, null, null, 30, null], 18)).toBe(4);
  });

  it("is null with nothing to find", () => {
    expect(nearestIndex([], 1)).toBeNull();
    expect(nearestIndex([null, null], 1)).toBeNull();
  });

  it("agrees with a linear scan on a long series", () => {
    const xs = Array.from({ length: 400 }, (_, i) => (i % 7 === 3 ? null : i * 2.5));
    for (const x of [0, 1.2, 333, 512.4, 997, 1100]) {
      const best = xs.reduce<number | null>((bi, v, i) => (v === null ? bi : bi === null || Math.abs(v - x) < Math.abs((xs[bi] as number) - x) ? i : bi), null);
      expect(Math.abs((xs[nearestIndex(xs, x)!] as number) - x)).toBe(Math.abs((xs[best!] as number) - x));
    }
  });
});
