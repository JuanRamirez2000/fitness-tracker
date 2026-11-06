import { describe, expect, it } from "vitest";
import type { RunEfforts } from "@/lib/data/activity-details";
import { addDays } from "@/lib/dates/calendar";
import { TODAY, testDashboardData, testRun } from "@/lib/kpis/testing";
import { METERS_PER_MILE } from "@/lib/running/runs";
import { buildBestEfforts } from "./best-efforts";

const effort = (daysAgo: number, mile: number | null, longest: number, over: Partial<RunEfforts["efforts"]["fastest"]> = {}): RunEfforts => ({
  activity_id: `00000000-0000-4000-8000-${String(daysAgo).padStart(12, "0")}`,
  local_date: addDays(TODAY, -daysAgo),
  name: `Run ${daysAgo}`,
  efforts: { fastest: { mile, two_mile: null, five_k: null, ...over }, longest_running: { seconds: longest, meters: null } },
});

describe("buildBestEfforts", () => {
  const month = { key: "month" as const, from: addDays(TODAY, -29), to: TODAY };

  it("keeps the all-time best, the range's best against the record before it, and each record", () => {
    const runEfforts = [effort(60, 700, 300), effort(40, 680, 240), effort(10, 690, 600), effort(2, 650, 420)];
    const e = buildBestEfforts(testDashboardData({ runEfforts, dateRange: month }));
    const mile = e.find((x) => x.id === "mile")!;
    expect(mile.best).toMatchObject({ value: 650, name: "Run 2" });
    expect(mile.inRange!.value).toBe(650);
    expect(mile.before!.value).toBe(680);
    expect(mile.records.map((r) => r.value)).toEqual([700, 680, 650]);

    const running = e.find((x) => x.id === "longest_running")!;
    expect(running).toMatchObject({ better: "higher", best: { value: 600 } });
    expect(running.records.map((r) => r.value)).toEqual([300, 600]);
  });

  it("prefers Garmin's own fastest mile when the run has one", () => {
    const run = testRun({ local_date: addDays(TODAY, -2), fastest_mile_s: 640 });
    const runEfforts = [{ ...effort(2, 650, 300), activity_id: run.id }];
    const mile = buildBestEfforts(testDashboardData({ activities: [run], runEfforts, dateRange: month })).find((x) => x.id === "mile")!;
    expect(mile.best.value).toBe(640);
  });

  it("takes the longest run from every run, and leaves out efforts no run has", () => {
    const runs = [testRun({ local_date: addDays(TODAY, -5), distance_m: 3 * METERS_PER_MILE }), testRun({ local_date: addDays(TODAY, -40), distance_m: 4 * METERS_PER_MILE })];
    const e = buildBestEfforts(testDashboardData({ activities: runs, runEfforts: [effort(5, 700, 200)], dateRange: month }));
    const longest = e.find((x) => x.id === "longest_run")!;
    expect(longest.best.value).toBeCloseTo(4);
    expect(longest.inRange!.value).toBeCloseTo(3);
    expect(e.some((x) => x.id === "five_k")).toBe(false);
  });
});
