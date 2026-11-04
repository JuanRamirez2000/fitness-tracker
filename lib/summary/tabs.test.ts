import { describe, expect, it } from "vitest";
import { testRun, testTraining, trendRow } from "@/lib/kpis/testing";
import { hasEnoughForTrainingSummary, trainingFacts } from "./training";
import { hasEnoughForWeightSummary, weightFacts } from "./weight";

const TODAY = "2026-11-03";
const PROFILE = { goal_weight_lb: 200, goal_pace_lb_per_week: 1, start_weight_lb: 288, program_start_date: "2026-09-10" };
const comp = (local_date: string, weight_lb: number, body_fat_pct: number) => ({
  local_date,
  weight_lb,
  body_fat_pct,
  muscle_mass_lb: 99.6,
  bone_mass_lb: 16.8,
  body_water_pct: 48.3,
});

describe("weightFacts", () => {
  it("reports the average's movement, goal progress and fat vs lean", () => {
    const facts = weightFacts({
      today: TODAY,
      profile: PROFILE,
      weightTrend: [
        trendRow({ local_date: "2026-10-04", weight_lb: 276, avg7_lb: 276.5 }),
        trendRow({ local_date: "2026-10-27", weight_lb: 274, avg7_lb: 273.4 }),
        trendRow({ local_date: TODAY, weight_lb: 272.4, avg7_lb: 272.8 }),
      ],
      bodyComposition: [comp("2026-09-02", 284, 35.4), comp("2026-10-04", 276.5, 34.5), comp(TODAY, 272.4, 33.9)],
    });
    expect(facts.weight_lb).toEqual({
      latest_weigh_in: 272.4,
      latest_weigh_in_date: TODAY,
      seven_day_average: 272.8,
      average_change_last_7_days: -0.6,
      average_change_last_30_days: -3.7,
    });
    expect(facts.program).toEqual({
      start_weight: 288,
      started_on: "2026-09-10",
      lost_since_start: 15.2,
      goal_weight: 200,
      left_to_goal: 72.8,
      planned_loss_lb_per_week: 1,
    });
    const body = facts.body_composition as Record<string, Record<string, number>>;
    expect(body.body_fat_percent).toBe(33.9);
    expect(body.since_first_scale_reading.date).toBe("2026-09-02");
    expect(body.since_first_scale_reading.share_of_loss_that_was_fat_percent).toBeGreaterThan(50);
    expect(body.last_30_days.fat_change_lb).toBeLessThan(0);
    expect(hasEnoughForWeightSummary(facts)).toBe(true);
  });

  it("is empty without a recent weigh-in", () => {
    const facts = weightFacts({ today: TODAY, profile: PROFILE, weightTrend: [trendRow({ local_date: "2026-10-01", weight_lb: 280, avg7_lb: 280 })], bodyComposition: [] });
    expect(facts).toEqual({ date: TODAY });
    expect(hasEnoughForWeightSummary(facts)).toBe(false);
  });
});

describe("trainingFacts", () => {
  it("covers the last week, load, focus, VO2 and race trend", () => {
    const facts = trainingFacts({
      today: TODAY,
      profile: { hr_zone_bounds: null },
      activities: [
        testRun({ local_date: "2026-10-25" }), // the week before: 3 mi
        testRun({ local_date: "2026-11-01", hr_zone_s: [600, 1200, 0, 0, 0] }),
        testRun({ local_date: "2026-11-03", hr_zone_s: [0, 0, 1200, 0, 0] }),
      ],
      training: [
        testTraining({ local_date: "2026-10-03", vo2max: 40, race_5k_s: 1928, race_10k_s: 4100, race_half_s: 9500 }),
        testTraining({
          local_date: TODAY,
          acute_load: 237,
          chronic_load: 172,
          chronic_low: 137.6,
          chronic_high: 258,
          acwr: 1.3,
          status: "PRODUCTIVE",
          focus: {
            aerobic_low: { value: 300.9, low: 80, high: 240 },
            aerobic_high: { value: 200, low: 120, high: 240 },
            anaerobic: { value: 0, low: 0, high: 140 },
          },
          vo2max: 42.2,
          race_5k_s: 1738,
          race_10k_s: 3802,
          race_half_s: 8834,
          fitness_age: 27.1,
          chronological_age: 26,
        }),
      ],
    });
    expect(facts.running_last_7_days).toEqual({ runs: 2, miles: 6, miles_the_week_before: 3, easy_share_of_time_percent: 60, easy_share_aim_percent: 80 });
    expect(facts.training_load).toEqual({
      acute: 237,
      chronic: 172,
      optimal_chronic_range: [137.6, 258],
      acute_chronic_ratio: 1.3,
      healthy_ratio_range: [0.8, 1.5],
      status: "Productive",
    });
    expect(facts.load_focus_last_4_weeks).toMatchObject({ "Aerobic low": { load: 301, state: "above" }, Anaerobic: { state: "in range" } });
    expect(facts.vo2_max).toEqual({ latest: 42.2, change_last_30_days: 2.2 });
    expect(facts.race_predictions).toEqual({
      "5K": { predicted: "28:58", seconds_faster_than_30_days_ago: 190 },
      "10K": { predicted: "1:03:22", seconds_faster_than_30_days_ago: 298 },
      half_marathon: { predicted: "2:27:14", seconds_faster_than_30_days_ago: 666 },
    });
    expect(facts.fitness_age).toEqual({ fitness_age: 27.1, real_age: 26 });
    expect(hasEnoughForTrainingSummary(facts)).toBe(true);
  });

  it("leaves out the easy share when some of the week's runs have no zone data", () => {
    const facts = trainingFacts({
      today: TODAY,
      profile: { hr_zone_bounds: null },
      activities: [testRun({ local_date: "2026-11-01", hr_zone_s: null }), testRun({ local_date: "2026-11-03", hr_zone_s: [9, 158, 1017, 544, 0] })],
      training: [],
    });
    expect(facts.running_last_7_days).toEqual({ runs: 2, miles: 6, miles_the_week_before: 0 });
  });

  it("is empty without recent running or load", () => {
    const facts = trainingFacts({ today: TODAY, profile: { hr_zone_bounds: null }, activities: [], training: [] });
    expect(facts).toEqual({ date: TODAY });
    expect(hasEnoughForTrainingSummary(facts)).toBe(false);
  });
});
