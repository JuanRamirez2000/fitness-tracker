import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates/calendar";
import { TODAY, testRide, testRun } from "@/lib/kpis/testing";
import { METERS_PER_MILE } from "@/lib/running/runs";
import { brickOf, buildBricks, findBricks, firstMileDrop, offBikeCost, type BrickRunDetail } from "./bricks";

const day = addDays(TODAY, -3);
/** A 60-minute ride starting 14:00 UTC, so it ends at 15:00. */
const ride = testRide({ local_date: day, started_at: `${day}T14:00:00Z`, duration_s: 3600 });
const runAt = (clock: string, over = {}) => testRun({ local_date: day, started_at: `${day}T${clock}Z`, ...over });

describe("findBricks", () => {
  it("pairs a run starting within 15 minutes of the ride's end", () => {
    const run = runAt("15:08:00");
    const [b] = findBricks([ride, run]);
    expect(b.ride.id).toBe(ride.id);
    expect(b.run.id).toBe(run.id);
    expect(b.gapS).toBe(8 * 60);
    expect(brickOf(ride.id, [ride, run])?.run.id).toBe(run.id);
  });

  it("leaves out a run more than 15 minutes later, or one before the ride", () => {
    expect(findBricks([ride, runAt("15:20:00")])).toEqual([]);
    expect(findBricks([ride, testRun({ local_date: day, started_at: `${day}T12:00:00Z` })])).toEqual([]);
  });

  it("allows a small overlap and pairs each ride once", () => {
    const first = runAt("14:59:30", { id: "00000000-0000-4000-8000-000000000001" });
    const second = runAt("15:10:00", { id: "00000000-0000-4000-8000-000000000002" });
    const bricks = findBricks([ride, first, second]);
    expect(bricks).toHaveLength(1);
    expect(bricks[0]).toMatchObject({ gapS: 0, run: { id: first.id } });
  });
});

describe("offBikeCost", () => {
  it("compares against fresh runs at the same heart rate, scaled to the brick's", () => {
    // Fresh runs: 12:00/mi at 130 bpm. The brick: 13:00/mi at 130 bpm, so 60 s/mi slower.
    const fresh = [5, 10, 20].map((n) => testRun({ local_date: addDays(day, -n) }));
    const brick = runAt("15:05:00", { avg_grade_adjusted_speed_mps: METERS_PER_MILE / 780, avg_speed_mps: METERS_PER_MILE / 780 });
    const cost = offBikeCost(brick, [...fresh, ride, brick], new Set([brick.id]))!;
    expect(cost.freshRuns).toBe(3);
    expect(cost.freshPace).toBeCloseTo(720);
    expect(cost.costS).toBeCloseTo(60);
  });

  it("needs three fresh runs within 10 bpm", () => {
    const fresh = [testRun({ local_date: addDays(day, -5) }), testRun({ local_date: addDays(day, -6), avg_hr: 150 })];
    expect(offBikeCost(runAt("15:05:00"), fresh, new Set())).toBeNull();
  });
});

describe("firstMileDrop", () => {
  const split = (mile: number, duration_s: number, distance_m = METERS_PER_MILE) => ({
    mile,
    distance_m,
    duration_s,
    avg_hr: null,
    avg_cadence_spm: null,
    avg_gap_mps: null,
    elevation_gain_m: 0,
    elevation_loss_m: 0,
  });

  it("uses the first mile against the rest on longer runs", () => {
    const detail: BrickRunDetail = { activity_id: "x", mile_splits: [split(1, 780), split(2, 720), split(3, 360, METERS_PER_MILE / 2)], t: null, d: null };
    const drop = firstMileDrop(detail, 2.5)!;
    expect(drop.by).toBe("mile");
    expect(drop.restPace).toBeCloseTo(720);
    expect(drop.dropS).toBeCloseTo(60);
  });

  it("uses the first 5 minutes against the rest on short runs", () => {
    // 400 m in the first 300 s, then 800 m in the next 450 s.
    const detail: BrickRunDetail = { activity_id: "x", mile_splits: [split(1, 750, 1200)], t: [0, 150, 300, 600, 750], d: [0, 200, 400, 933, 1200] };
    const drop = firstMileDrop(detail, 0.75)!;
    expect(drop.by).toBe("opening");
    expect(drop.firstPace).toBeCloseTo((300 / 400) * METERS_PER_MILE);
    expect(drop.restPace).toBeCloseTo((450 / 800) * METERS_PER_MILE);
  });

  it("is null without enough after the opening", () => {
    expect(firstMileDrop({ activity_id: "x", mile_splits: null, t: [0, 300, 400], d: [0, 400, 500] }, 0.3)).toBeNull();
  });
});

describe("buildBricks", () => {
  it("is null before the first brick, and keeps the last one before an empty range", () => {
    expect(buildBricks({ activities: [ride], brickRuns: [], dateRange: { key: "week", from: TODAY, to: TODAY } })).toBeNull();
    const s = buildBricks({ activities: [ride, runAt("15:04:00")], brickRuns: [], dateRange: { key: "week", from: addDays(TODAY, -1), to: TODAY } })!;
    expect(s.rows).toEqual([]);
    expect(s.total).toBe(1);
    expect(s.lastBefore).toBe(day);
  });

  it("lists the range's bricks newest first with their averages", () => {
    const later = addDays(TODAY, -1);
    const ride2 = testRide({ local_date: later, started_at: `${later}T14:00:00Z` });
    const run2 = testRun({ local_date: later, started_at: `${later}T15:02:00Z` });
    const s = buildBricks({ activities: [ride, runAt("15:04:00"), ride2, run2], brickRuns: [], dateRange: { key: "week", from: addDays(TODAY, -6), to: TODAY } })!;
    expect(s.rows.map((r) => r.date)).toEqual([later, day]);
    expect(s.avgGapS).toBe(180);
    expect(s.rows[0]).toMatchObject({ rideMinutes: 60, cost: null, drop: null });
  });
});
