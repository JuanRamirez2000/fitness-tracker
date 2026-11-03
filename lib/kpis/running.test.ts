import { describe, expect, it } from "vitest";
import { TODAY, testDashboardData, testRun } from "./testing";
import { easyPace } from "./easy-pace";
import { vo2max } from "./vo2max";
import { weeklyMiles } from "./weekly-miles";

// TODAY is 2026-09-20.
describe("weeklyMiles", () => {
  it("is empty with no runs at all", () => {
    expect(weeklyMiles.compute(testDashboardData())).toBeNull();
  });

  it("totals the last 7 days against the 7 before", () => {
    const data = testDashboardData({
      activities: [
        testRun({ local_date: "2026-09-10" }), // previous week
        testRun({ local_date: "2026-09-14" }),
        testRun({ local_date: TODAY, distance_m: 5 * 1609.344 }),
        testRun({ local_date: "2026-09-19", activity_type: "cycling" }), // not a run
      ],
    });
    const v = weeklyMiles.compute(data)!;
    expect(v.value).toBeCloseTo(8);
    expect(v.delta).toBeCloseTo(5);
    expect(v.sub).toBe("Last 7 days · 2 runs · longest 5.0 mi");
    expect(v.series).toHaveLength(8);
    expect(weeklyMiles.format(v)).toMatchObject({ primary: "8.0", delta: "+5.0 mi" });
  });
});

describe("easyPace", () => {
  it("is the median easy pace at 130 bpm over the last 4 weeks, faster than before is good", () => {
    const data = testDashboardData({
      activities: [
        testRun({ local_date: "2026-08-01" }), // 4-8 weeks ago, 12:00/mi
        testRun({ local_date: "2026-09-01", avg_hr: 120 }),
        testRun({ local_date: "2026-09-10", avg_hr: 120 }),
        testRun({ local_date: "2026-09-12", training_effect_label: "THRESHOLD", avg_hr: 170 }), // a workout, ignored
      ],
    });
    const v = easyPace.compute(data)!;
    expect(v.value).toBeCloseTo(720 * (120 / 130));
    expect(v.tone).toBe("good");
    expect(easyPace.format(v)).toMatchObject({ primary: "11:05", delta: "−0:55" });
  });

  it("is empty without a recent easy run", () => {
    expect(easyPace.compute(testDashboardData({ activities: [testRun({ local_date: "2026-07-01" })] }))).toBeNull();
  });
});

describe("vo2max", () => {
  it("shows the latest estimate against the one from about 3 months ago", () => {
    const data = testDashboardData({
      activities: [
        testRun({ local_date: "2026-05-01", vo2max: 38 }),
        testRun({ local_date: "2026-09-15", vo2max: 41 }),
        testRun({ local_date: "2026-09-19", vo2max: null }),
      ],
    });
    const v = vo2max.compute(data)!;
    expect(v).toMatchObject({ value: 41, delta: 3, tone: "good" });
    expect(v.sub).toBe("As of Sep 15 · vs 3 months ago");
    expect(vo2max.format(v)).toMatchObject({ primary: "41", delta: "+3" });
  });
});
