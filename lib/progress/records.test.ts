import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun, testTraining } from "@/lib/kpis/testing";
import { buildRecords } from "./records";

describe("buildRecords", () => {
  const base = { programStart: "2026-10-01", today: "2026-11-20" };

  it("marks power bests and the longest ride, never the first ride", () => {
    const rides = [
      testRide({ local_date: "2026-10-05", power_curve: { "60": 300, "300": 220 }, moving_duration_s: 3600 }),
      testRide({ local_date: "2026-11-02", power_curve: { "60": 320, "300": 210 }, moving_duration_s: 5400 }),
    ];
    const records = buildRecords(testDashboardData({ ...base, activities: rides }));
    const titles = records.map((r) => `${r.title} ${r.value} (${r.previous})`);
    expect(titles).toContain("Best 1 min power 320 W (was 300 W)");
    expect(titles).toContain("Longest ride 1:30:00 (was 1:00:00)");
    expect(titles.some((t) => t.startsWith("Best 5 min power"))).toBe(false);
  });

  it("counts running miles adding up since the start, and VO2 max highs", () => {
    const runs = Array.from({ length: 9 }, (_, i) => testRun({ local_date: `2026-10-${String(2 + i * 3).padStart(2, "0")}` }));
    const training = [testTraining({ local_date: "2026-10-02", vo2max: 41 }), testTraining({ local_date: "2026-11-01", vo2max: 42 })];
    const records = buildRecords(testDashboardData({ ...base, activities: runs, training }));
    expect(records.find((r) => r.key === "run-miles:25")).toMatchObject({ date: "2026-10-26", kind: "milestone" });
    expect(records.find((r) => r.title === "Running VO2 max high")).toMatchObject({ value: "42.0", previous: "was 41.0" });
  });

  it("leaves out records from before the program began, newest first", () => {
    const rides = [
      testRide({ local_date: "2026-08-01", moving_duration_s: 1800 }),
      testRide({ local_date: "2026-09-01", moving_duration_s: 2400 }),
      testRide({ local_date: "2026-10-10", moving_duration_s: 3000 }),
    ];
    const records = buildRecords(testDashboardData({ ...base, activities: rides })).filter((r) => r.title === "Longest ride");
    expect(records.map((r) => r.date)).toEqual(["2026-10-10"]);
  });
});
