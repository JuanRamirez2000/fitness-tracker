import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates/calendar";
import { TODAY, testRide, testRun } from "@/lib/kpis/testing";
import { brickOf, findBricks } from "./bricks";

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

