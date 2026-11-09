import { describe, expect, it } from "vitest";
import { buildActivityView } from "@/lib/activity/view";
import { testRide, testRun } from "@/lib/kpis/testing";
import { METERS_PER_MILE } from "@/lib/running/runs";
import { activityFacts } from "./activity";

const PROFILE = { timezone: "America/Los_Angeles", hr_zone_bounds: null };
const run = testRun({ local_date: "2026-11-03", started_at: "2026-11-04T00:00:46Z", training_effect_label: "TEMPO", hr_zone_s: [0, 60, 600, 300, 0] });

describe("activityFacts", () => {
  it("lists the modal's own stats, labelled as it shows them", () => {
    const facts = activityFacts(buildActivityView({ activity: run, detail: null, activities: [run], recovery: null, sleep: null, trainingBefore: null, profile: PROFILE }));
    expect(facts.activity).toEqual({ type: "Run", name: "Test Run", date: "2026-11-03", start_time: "4:00 pm", kind: "workout", garmin_primary_benefit: "Tempo" });
    expect((facts.stats as Record<string, string>)["Avg pace"]).toBe("12:00 /mi");
    expect((facts.stats as Record<string, string>)["Aerobic effect"]).toBe("2.5 (Maintaining)");
    expect(facts.time_in_hr_zones_percent).toEqual({ Z1: 0, Z2: 6, Z3: 63, Z4: 31, Z5: 0 });
    expect(facts.running_that_week).toEqual({ miles_in_7_days_to_this_run: 3, runs: 1, miles_the_week_before: 0 });
  });

  it("leaves out what isn't there: no splits, segments, comparison or morning without the rows", () => {
    const facts = activityFacts(buildActivityView({ activity: run, detail: null, activities: [run], recovery: null, sleep: null, trainingBefore: null, profile: PROFILE }));
    for (const key of ["mile_splits", "segments", "vs_similar_recent_runs", "that_morning", "load_going_in"]) expect(facts).not.toHaveProperty(key);
  });

  it("summarises a very long activity's miles instead of listing them", () => {
    const splits = Array.from({ length: 30 }, (_, i) => ({
      mile: i + 1,
      distance_m: METERS_PER_MILE,
      duration_s: 600 + i,
      avg_hr: 140,
      avg_cadence_spm: 160,
      avg_gap_mps: null,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    }));
    const detail = {
      activity_id: run.id, user_id: run.user_id, location_name: null, workout_feel: null, workout_rpe: null, min_hr: null,
      stamina_start: null, stamina_end: null, series: null, mile_splits: splits, interval_splits: null, efforts: null, ride_splits: null, fetched_at: "2026-11-04T00:00:00Z",
    };
    const facts = activityFacts(buildActivityView({ activity: run, detail, activities: [run], recovery: null, sleep: null, trainingBefore: null, profile: PROFILE }));
    expect(facts).not.toHaveProperty("mile_splits");
    expect(facts.mile_splits_summary).toMatchObject({ miles: 30, fastest: "10:00", slowest: "10:29" });
  });

  it("gives a ride its power, splits and week of riding, and no pace", () => {
    const ride = testRide({ local_date: "2026-11-08", activity_type: "indoor_cycling", training_effect_label: "AEROBIC_BASE" });
    const detail = {
      activity_id: ride.id, user_id: ride.user_id, location_name: null, workout_feel: null, workout_rpe: null, min_hr: null,
      stamina_start: null, stamina_end: null, series: null, mile_splits: null, interval_splits: null, efforts: null, fetched_at: "2026-11-09T00:00:00Z",
      ride_splits: [{ split: 1, by: "time" as const, distance_m: 2000, duration_s: 300, avg_hr: 130, avg_power_w: 140, avg_cadence_rpm: 82, elevation_gain_m: 0, elevation_loss_m: 0 }],
    };
    const facts = activityFacts(buildActivityView({ activity: ride, detail, activities: [ride], recovery: null, sleep: null, trainingBefore: null, profile: PROFILE }));
    expect(facts.activity).toMatchObject({ type: "Indoor ride", kind: "easy ride", indoor: expect.stringContaining("trainer") });
    expect((facts.stats as Record<string, string>)["Norm. power"]).toBe("160 W");
    expect(facts.ride_splits).toEqual([{ split: "0–5 min", time: "5:00", avg_power_watts: 140, avg_hr: 130, cadence_rpm: 82 }]);
    expect(facts.riding_that_week).toEqual({ rides_in_7_days_to_this_one: 1, hours: 1, miles: 15 });
    expect(facts).not.toHaveProperty("running_that_week");
    expect(JSON.stringify(facts)).not.toContain("/mi");
  });
});
