import { describe, expect, it } from "vitest";
import { sparklinePath } from "./sparkline";

describe("sparklinePath", () => {
  it("draws a flat baseline for fewer than 2 points", () => {
    expect(sparklinePath([])).toBe("M2 23 L118 23");
    expect(sparklinePath([200])).toBe("M2 23 L118 23");
  });

  it("starts with M and continues with L for every later point", () => {
    const path = sparklinePath([1, 2, 3, 2]);
    expect(path.startsWith("M")).toBe(true);
    expect(path.match(/L/g)).toHaveLength(3);
  });

  it("spans the full width and normalizes a flat series without dividing by zero", () => {
    const path = sparklinePath([5, 5, 5]);
    expect(path).toBe("M2.0 23.0 L60.0 23.0 L118.0 23.0");
  });

  it("puts the minimum at the bottom and the maximum at the top", () => {
    const path = sparklinePath([0, 10]);
    const [, start, , end] = path.split(" ");
    expect(Number(start)).toBeGreaterThan(Number(end)); // min (first) below max (last)
  });

  it("is stable for the same input", () => {
    expect(sparklinePath([1, 5, 2, 8, 3])).toBe(sparklinePath([1, 5, 2, 8, 3]));
  });
});
