import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun } from "@/lib/kpis/testing";
import { activityColumns, buildActivityRows, trainingEffectWord } from "./activities";

const SEPTEMBER = { key: "custom" as const, from: "2026-09-01", to: "2026-09-30" };
const activities = [
  testRun({ local_date: "2026-08-31" }),
  testRun({ local_date: "2026-09-05", training_effect_label: "VO2MAX", aerobic_training_effect: 4 }),
  testRun({ local_date: "2026-09-10", activity_type: "walking" }),
  testRide({ local_date: "2026-09-11" }),
  testRun({ local_date: "2026-09-12" }),
];

describe("buildActivityRows", () => {
  it("under Run, lists runs in range, newest first, ready to display", () => {
    const rows = buildActivityRows(testDashboardData({ sport: "run", dateRange: SEPTEMBER, activities }));
    expect(rows.map((r) => r.local_date)).toEqual(["2026-09-12", "2026-09-05"]);
    expect(rows[0]).toMatchObject({ sport: "run", kind: "easy", miles: "3.00", time: "36:00", speed: "12:00/mi", avgHr: 130, cadence: 155, effect: "2.5 Maintaining", benefit: "aerobic base" });
    expect(rows[1]).toMatchObject({ kind: "workout", effect: "4.0 Highly improving", benefit: "vo2max" });
  });

  it("under Ride, lists rides with mph, power, rpm and climbing", () => {
    const rows = buildActivityRows(testDashboardData({ sport: "ride", dateRange: SEPTEMBER, activities }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sport: "ride", name: "Test Ride", miles: "15.0", time: "1:00:00", speed: "15.0 mph", power: 160, cadence: 85, elevFt: 492 });
  });

  it("under All, lists rides and runs but not walks, with watts only for rides", () => {
    const rows = buildActivityRows(
      testDashboardData({ sport: "all", dateRange: SEPTEMBER, activities: [...activities, testRun({ local_date: "2026-09-13", avg_power_w: 430 })] }),
    );
    expect(rows.map((r) => r.sport)).toEqual(["run", "run", "ride", "run"]);
    expect(rows.map((r) => r.power)).toEqual([null, null, 160, null]);
  });

  it("falls back to average power without normalized power", () => {
    const [row] = buildActivityRows(testDashboardData({ sport: "ride", dateRange: SEPTEMBER, activities: [testRide({ local_date: "2026-09-11", norm_power_w: null })] }));
    expect(row.power).toBe(150);
  });
});

describe("activityColumns", () => {
  it("keeps the running columns for runs and adds power and climbing for rides", () => {
    expect(activityColumns("run")).toEqual(["date", "type", "mi", "time", "speed", "hr", "cad", "effect"]);
    expect(activityColumns("ride")).toContain("power");
    expect(activityColumns("all")).toContain("sport");
  });
});

describe("trainingEffectWord", () => {
  it("follows Garmin's training effect scale", () => {
    expect(trainingEffectWord(0.4)).toBe("None");
    expect(trainingEffectWord(1.9)).toBe("Minor");
    expect(trainingEffectWord(2.4)).toBe("Maintaining");
    expect(trainingEffectWord(3.5)).toBe("Improving");
    expect(trainingEffectWord(4.1)).toBe("Highly improving");
    expect(trainingEffectWord(5)).toBe("Overreaching");
  });
});
