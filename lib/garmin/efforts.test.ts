import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildActivityDetailRow } from "./details";
import { bestEfforts, fastestOver, longestRunning } from "./efforts";

describe("fastestOver", () => {
  it("finds the quickest stretch of a distance anywhere in the run, interpolating its start", () => {
    // 100 s at 2 m/s, then 100 s at 4 m/s (400 m), then 100 s at 2 m/s. The best 400 m is the fast
    // part; the best 600 m adds 200 m of the slow part either side: 100 s + 100 s.
    const t = Array.from({ length: 31 }, (_, i) => i * 10);
    let dist = 0;
    const d = t.map((s, i) => {
      if (i > 0) dist += s <= 100 || s > 200 ? 20 : 40;
      return dist;
    });
    expect(fastestOver(t, d, 400)).toBe(100);
    expect(fastestOver(t, d, 600)).toBe(200);
  });

  it("is null when the run is shorter than the distance", () => {
    expect(fastestOver([0, 10], [0, 50], 1609)).toBeNull();
  });
});

describe("longestRunning", () => {
  it("measures the longest stretch at running cadence, riding over a short dip", () => {
    const t = Array.from({ length: 13 }, (_, i) => i * 10);
    const d = t.map((s) => s * 2.5);
    //               run run run dip run run walk walk walk run run run run
    const cadence = [160, 160, 160, 120, 162, 160, 110, 112, 110, 158, 160, 161, 159];
    expect(longestRunning(t, d, cadence)).toEqual({ seconds: 50, meters: 125 });
  });

  it("is null without cadence", () => {
    expect(longestRunning([0, 10], [0, 20], undefined)).toBeNull();
  });
});

describe("bestEfforts on a real run", () => {
  const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
  it("finds a mile and a 2-mile but no 5K in a 2.5-mile run/walk, and its longest running stretch", () => {
    const row = buildActivityDetailRow(fixture("activity-details.json"), null, { withMileSplits: true });
    const e = row.efforts!;
    expect(e.fastest.mile).toBeGreaterThan(540); // under 9:00 is not this run
    expect(e.fastest.mile).toBeLessThan(720);
    expect(e.fastest.two_mile).toBeGreaterThan(e.fastest.mile! * 2 - 1);
    expect(e.fastest.five_k).toBeNull();
    // Garmin's run segments were 8 of about 3 minutes: the longest is a few minutes, not the whole run.
    expect(e.longest_running!.seconds).toBeGreaterThan(120);
    expect(e.longest_running!.seconds).toBeLessThan(1200);
  });

  it("has none for a ride or swim (no mile splits asked for)", () => {
    expect(buildActivityDetailRow(fixture("activity-details.json"), null, { withMileSplits: false }).efforts).toBeNull();
    expect(bestEfforts([0], undefined, undefined)).toEqual({ fastest: { mile: null, two_mile: null, five_k: null }, longest_running: null });
  });
});
