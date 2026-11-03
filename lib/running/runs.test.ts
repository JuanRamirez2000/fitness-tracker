import { describe, expect, it } from "vitest";
import { testRun } from "@/lib/kpis/testing";
import { easyPaceAtRefHr, fmtDuration, fmtPace, isEasyRun, median, runMiles, runsOf } from "./runs";

describe("runsOf", () => {
  it("keeps every running type and drops the rest", () => {
    const activities = [
      testRun({ local_date: "2026-09-01" }),
      testRun({ local_date: "2026-09-02", activity_type: "treadmill_running" }),
      testRun({ local_date: "2026-09-03", activity_type: "cycling" }),
    ];
    expect(runsOf(activities).map((r) => r.local_date)).toEqual(["2026-09-01", "2026-09-02"]);
  });
});

describe("easyPaceAtRefHr", () => {
  it("is the run's own pace when it was run at 130 bpm", () => {
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01" }))).toBeCloseTo(720);
  });

  it("scales pace to 130 bpm, so the same pace at a lower heart rate scores faster", () => {
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01", avg_hr: 120 }))).toBeCloseTo(720 * (120 / 130));
  });

  it("prefers grade-adjusted speed", () => {
    const run = testRun({ local_date: "2026-09-01", avg_speed_mps: 2, avg_grade_adjusted_speed_mps: 1609.344 / 600 });
    expect(easyPaceAtRefHr(run)).toBeCloseTo(600);
  });

  it("skips workouts, runs without heart rate, and runs under a mile", () => {
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01", training_effect_label: "THRESHOLD" }))).toBeNull();
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01", avg_hr: null }))).toBeNull();
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01", distance_m: 1000 }))).toBeNull();
  });

  it("skips easy-labeled runs too far from 130 bpm to scale fairly", () => {
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01", avg_hr: 145 }))).not.toBeNull();
    expect(easyPaceAtRefHr(testRun({ local_date: "2026-09-01", avg_hr: 158 }))).toBeNull();
  });
});

describe("helpers", () => {
  it("classifies easy runs from Garmin's training-effect label", () => {
    expect(isEasyRun(testRun({ local_date: "2026-09-01", training_effect_label: "RECOVERY" }))).toBe(true);
    expect(isEasyRun(testRun({ local_date: "2026-09-01", training_effect_label: "VO2MAX" }))).toBe(false);
    expect(isEasyRun(testRun({ local_date: "2026-09-01", training_effect_label: null }))).toBe(false);
  });

  it("measures miles and formats paces and durations", () => {
    expect(runMiles(testRun({ local_date: "2026-09-01" }))).toBeCloseTo(3);
    expect(fmtPace(725)).toBe("12:05");
    expect(fmtDuration(2000)).toBe("33:20");
    expect(fmtDuration(4000)).toBe("1:06:40");
  });

  it("takes the median of odd and even lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
