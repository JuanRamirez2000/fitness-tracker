import { describe, expect, it } from "vitest";
import { weeklyBuckets } from "./weekly-buckets";

describe("weeklyBuckets", () => {
  it("groups a full range into Sunday-start weeks, oldest first", () => {
    // 2026-09-01 is a Tuesday, so the first bucket is a partial week (Tue-Sat).
    const buckets = weeklyBuckets({ from: "2026-09-01", to: "2026-09-14" });
    expect(buckets).toEqual([
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"],
      ["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"],
      ["2026-09-13", "2026-09-14"],
    ]);
  });

  it("returns one bucket for a single day", () => {
    expect(weeklyBuckets({ from: "2026-09-22", to: "2026-09-22" })).toEqual([["2026-09-22"]]);
  });

  it("returns nothing for an inverted window", () => {
    expect(weeklyBuckets({ from: "2026-09-22", to: "2026-09-01" })).toEqual([]);
  });
});
