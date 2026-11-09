import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun } from "@/lib/kpis/testing";
import { buildRideEfficiency } from "./ride-efficiency";

const RANGE = { key: "custom" as const, from: "2026-09-01", to: "2026-09-30" };

describe("buildRideEfficiency", () => {
  it("scores easy rides with power by watts per heartbeat, with a rolling median", () => {
    const chart = buildRideEfficiency(
      testDashboardData({
        dateRange: RANGE,
        activities: [
          testRide({ local_date: "2026-09-02", avg_power_w: 130, avg_hr: 130 }),
          testRide({ local_date: "2026-09-09", avg_power_w: 150, avg_hr: 125, activity_type: "indoor_cycling" }),
          testRide({ local_date: "2026-09-10", training_effect_label: "THRESHOLD", avg_power_w: 250, avg_hr: 165 }), // a workout
          testRide({ local_date: "2026-09-11", avg_power_w: null }), // no power meter
          testRide({ local_date: "2026-09-12", moving_duration_s: 600 }), // too short
          testRun({ local_date: "2026-09-13" }),
        ],
      }),
    )!;
    expect(chart.points.map((p) => p.local_date)).toEqual(["2026-09-02", "2026-09-09"]);
    expect(chart.points[0].wattsPerBeat).toBeCloseTo(1, 6);
    expect(chart.points[1]).toMatchObject({ wattsPerBeat: 1.2, indoor: true, trend: 1.1 });
    expect(chart.changePct).toBeCloseTo(10, 6);
  });

  it("is null without an easy ride with power in range", () => {
    expect(buildRideEfficiency(testDashboardData({ dateRange: RANGE, activities: [testRide({ local_date: "2026-08-01" })] }))).toBeNull();
  });
});
