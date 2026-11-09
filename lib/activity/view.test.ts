import { describe, expect, it } from "vitest";
import type { ActivityDetail } from "@/lib/data/activity-details";
import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import { testRide, testRun } from "@/lib/kpis/testing";
import { METERS_PER_MILE } from "@/lib/running/runs";
import { buildActivityView, feelWord, paceOf, typeLabel, type ActivityViewInput } from "./view";

const PROFILE = { timezone: "America/Los_Angeles", hr_zone_bounds: [[100, 120], [121, 140], [141, 160], [161, 180], [181, 200]] as [number, number][] };

function detail(over: Partial<ActivityDetail> = {}): ActivityDetail {
  return {
    activity_id: "00000000-0000-4000-8000-000000000001",
    user_id: "00000000-0000-4000-8000-000000000000",
    location_name: "Sample Town",
    workout_feel: 75,
    workout_rpe: 60,
    min_hr: 95,
    stamina_start: 100,
    stamina_end: 84,
    series: { t: [0, 60], d: [0, 200], hr: [120, 150], speed: [3, 3.2] },
    mile_splits: [
      { mile: 1, distance_m: METERS_PER_MILE, duration_s: 660, avg_hr: 150, avg_cadence_spm: 160, avg_gap_mps: 2.5, elevation_gain_m: 3, elevation_loss_m: 1 },
      { mile: 2, distance_m: 0.5 * METERS_PER_MILE, duration_s: 345, avg_hr: 158, avg_cadence_spm: 162, avg_gap_mps: null, elevation_gain_m: 0, elevation_loss_m: 0 },
    ],
    interval_splits: [
      { type: "RWD_WALK", count: 8, distance_m: 900, duration_s: 600, avg_speed_mps: 1.5, avg_hr: 140, max_hr: 150, avg_cadence_spm: 110, avg_cadence_rpm: null, avg_power_w: null, elevation_gain_m: 1 },
      { type: "RWD_RUN", count: 8, distance_m: 3600, duration_s: 1440, avg_speed_mps: 2.5, avg_hr: 155, max_hr: 172, avg_cadence_spm: 160, avg_cadence_rpm: null, avg_power_w: null, elevation_gain_m: 7 },
      { type: "INTERVAL_ACTIVE", count: 1, distance_m: 4500, duration_s: 2040, avg_speed_mps: 2.2, avg_hr: 151, max_hr: 172, avg_cadence_spm: 150, avg_cadence_rpm: null, avg_power_w: null, elevation_gain_m: 8 },
    ],
    efforts: null,
    ride_splits: null,
    fetched_at: "2026-11-04T00:00:00Z",
    ...over,
  };
}

const run = testRun({
  local_date: "2026-11-03",
  started_at: "2026-11-04T00:00:46Z",
  distance_m: 2.5 * METERS_PER_MILE,
  avg_speed_mps: METERS_PER_MILE / 690, // 11:30 /mi
  avg_hr: 154,
  training_effect_label: "TEMPO",
  training_load: 73,
  hr_zone_s: [9, 158, 1017, 544, 0],
  anaerobic_training_effect: 0.1,
  body_battery_change: -8,
});

function input(over: Partial<ActivityViewInput> = {}): ActivityViewInput {
  return { activity: run, detail: detail(), activities: [run], recovery: null, sleep: null, trainingBefore: null, profile: PROFILE, ...over };
}

describe("buildActivityView", () => {
  it("heads the modal with the run's name, start time in the athlete's zone, and Garmin's benefit", () => {
    const v = buildActivityView(input());
    expect(v).toMatchObject({ typeLabel: "Run", startClock: "4:00 pm", location: "Sample Town", kind: "workout", benefit: "Tempo", detailState: "ok" });
    expect(v.headline.map((s) => [s.label, s.value])).toEqual([
      ["Distance", "2.50"],
      ["Time", "36:00"],
      ["Pace", "11:30"],
      ["Avg HR", "154"],
      ["Load", "73"],
    ]);
  });

  it("shows feel and RPE as logged, and leaves out what Garmin didn't record", () => {
    const effort = buildActivityView(input()).groups.find((g) => g.title === "Effort")!;
    expect(effort.stats.find((s) => s.label === "Feel")?.value).toBe("Strong");
    expect(effort.stats.find((s) => s.label === "Effort (RPE)")?.value).toBe("6");
    expect(effort.stats.find((s) => s.label === "Body Battery")?.value).toBe("−8");
    const form = buildActivityView(input()).groups.find((g) => g.title === "Running form")!;
    expect(form.stats.some((s) => s.label === "Power")).toBe(false);
  });

  it("turns mile splits into paces, labelling a partial last mile by its length", () => {
    const { splits } = buildActivityView(input());
    expect(splits.map((s) => s.label)).toEqual(["1", "0.50"]);
    expect(splits[0].pace_s).toBeCloseTo(660);
    expect(splits[1].pace_s).toBeCloseTo(690);
  });

  it("lists run/walk segments and drops Garmin's whole-activity 'active' split", () => {
    expect(buildActivityView(input()).intervals.map((i) => [i.label, i.count])).toEqual([
      ["Running", 8],
      ["Walking", 8],
    ]);
  });

  it("shares time in each zone with the athlete's bounds", () => {
    const zones = buildActivityView(input()).zones!;
    expect(zones[2]).toMatchObject({ zone: 3, low: 141, high: 160 });
    expect(zones.reduce((s, z) => s + z.share, 0)).toBeCloseTo(1);
  });

  it("compares against earlier runs of about the same distance and kind", () => {
    const earlier = [1, 2, 3, 4].map((i) =>
      testRun({
        local_date: `2026-10-0${i}`,
        distance_m: 2.4 * METERS_PER_MILE,
        avg_speed_mps: METERS_PER_MILE / (700 + i * 10), // 11:50 .. 12:20
        avg_hr: 156,
        training_effect_label: "TEMPO",
      }),
    );
    const far = testRun({ local_date: "2026-10-05", distance_m: 8 * METERS_PER_MILE, training_effect_label: "TEMPO" });
    const sim = buildActivityView(input({ activities: [...earlier, far, run] })).context.similar!;
    expect(sim).toMatchObject({ count: 4, paceRank: 1, kind: "workout", hrDelta: -2 });
    expect(sim.paceDelta_s).toBe(-35); // 11:30 against a median of 12:05
    expect(sim.efficiencyPct).toBeGreaterThan(0);
  });

  it("has no comparison with too few similar runs", () => {
    expect(buildActivityView(input()).context.similar).toBeNull();
  });

  it("reads that morning's readiness at wake, sleep and HRV range", () => {
    const recovery = { local_date: "2026-11-03", readiness_score: 40, readiness_morning_score: 63, readiness_level: "MODERATE", hrv_ms: 46, hrv_baseline_low: 40, hrv_baseline_high: 49, resting_hr: 51, body_battery_wake: 80 } as DailyRecovery;
    const sleep = { local_date: "2026-11-03", duration_s: 27000, need_s: 25200, score: 82 } as SleepNight;
    expect(buildActivityView(input({ recovery, sleep })).context.morning).toEqual({
      readiness: 63,
      readinessLevel: "Moderate",
      sleepHours: 7.5,
      sleepNeedHours: 7,
      sleepScore: 82,
      hrv: 46,
      hrvRange: [40, 49],
      restingHr: 51,
      bodyBatteryWake: 80,
    });
  });

  it("counts the week's running up to and including the day", () => {
    const before = testRun({ local_date: "2026-10-30", distance_m: 3 * METERS_PER_MILE });
    const priorWeek = testRun({ local_date: "2026-10-25", distance_m: 4 * METERS_PER_MILE });
    expect(buildActivityView(input({ activities: [priorWeek, before, run] })).context.week).toEqual({
      sport: "run",
      miles: 5.5,
      count: 2,
      hours: 1.2,
      milesPrior: 4,
    });
  });

  it("says when detail was never fetched, or Garmin had none", () => {
    expect(buildActivityView(input({ detail: null })).detailState).toBe("missing");
    expect(buildActivityView(input({ detail: detail({ series: null, mile_splits: null }) })).detailState).toBe("none");
  });
});

describe("buildActivityView for a ride", () => {
  const CYCLING: [number, number][] = [[97, 115], [116, 134], [135, 153], [154, 173], [174, 193]];
  const ride = testRide({
    local_date: "2026-11-08",
    started_at: "2026-11-09T03:39:44Z",
    activity_type: "indoor_cycling",
    name: "Indoor Cycling",
    distance_m: 9477.6,
    duration_s: 1260,
    moving_duration_s: 1252,
    avg_speed_mps: 7.521,
    avg_hr: 145,
    avg_power_w: 139,
    max_power_w: 255,
    norm_power_w: 147,
    max_20min_power_w: 138,
    intensity_factor: 0.442,
    training_stress_score: 6.7,
    avg_cadence_rpm: 81,
    max_cadence_rpm: 100,
    training_effect_label: "AEROBIC_BASE",
    hr_zone_s: [37, 63, 1084, 62, 0],
  });
  const rideDetail = detail({
    mile_splits: null,
    interval_splits: null,
    ride_splits: [
      { split: 1, by: "time", distance_m: 2200, duration_s: 300, avg_hr: 130, avg_power_w: 130, avg_cadence_rpm: 80, elevation_gain_m: 0, elevation_loss_m: 0 },
      { split: 2, by: "time", distance_m: 2300, duration_s: 300, avg_hr: 146, avg_power_w: 142, avg_cadence_rpm: 82, elevation_gain_m: 0, elevation_loss_m: 0 },
      { split: 3, by: "time", distance_m: 1500, duration_s: 200, avg_hr: 150, avg_power_w: 150, avg_cadence_rpm: 84, elevation_gain_m: 0, elevation_loss_m: 0 },
    ],
  });
  const rideInput = (over: Partial<ActivityViewInput> = {}) =>
    input({ activity: ride, detail: rideDetail, activities: [ride], profile: { ...PROFILE, hr_zone_bounds_cycling: CYCLING }, ...over });

  it("heads an indoor ride with speed and normalized power, and charts it against time", () => {
    const v = buildActivityView(rideInput());
    expect(v).toMatchObject({ typeLabel: "Indoor ride", isRide: true, isRun: false, indoor: true, kind: "easy" });
    expect(v.headline.map((s) => [s.label, s.value])).toEqual([
      ["Distance", "5.9"],
      ["Time", "20:52"],
      ["Speed", "16.8"],
      ["Norm. power", "147"],
      ["Avg HR", "145"],
      ["Load", "40"],
    ]);
  });

  it("lists power, intensity, TSS and rpm cadence", () => {
    const group = buildActivityView(rideInput()).groups.find((g) => g.title === "Power and cadence")!;
    expect(Object.fromEntries(group.stats.map((s) => [s.label, s.value]))).toEqual({
      "Avg power": "139",
      Normalized: "147",
      "Max power": "255",
      "Best 20 min": "138",
      "Intensity factor": "0.44",
      TSS: "7",
      Cadence: "81",
    });
    expect(buildActivityView(rideInput()).groups.some((g) => g.title === "Running form")).toBe(false);
  });

  it("labels zones with Garmin's cycling bounds", () => {
    expect(buildActivityView(rideInput()).zones![0]).toMatchObject({ low: 97, high: 115 });
  });

  it("labels 5-minute splits, the last by where it ended", () => {
    const splits = buildActivityView(rideInput()).rideSplits;
    expect(splits.map((s) => s.label)).toEqual(["0–5 min", "5–10 min", "10–13 min"]);
    expect(splits[1]).toMatchObject({ power: 142, cadence: 82, hr: 146, duration: "5:00" });
  });

  it("shows a ride's intervals in mph, not pace", () => {
    const v = buildActivityView(
      rideInput({
        detail: detail({
          interval_splits: [
            { type: "INTERVAL_WARMUP", count: 1, distance_m: 1609, duration_s: 300, avg_speed_mps: 5.36, avg_hr: 120, max_hr: 130, avg_cadence_spm: null, avg_cadence_rpm: 80, avg_power_w: 110, elevation_gain_m: 0 },
            { type: "INTERVAL_ACTIVE", count: 4, distance_m: 6000, duration_s: 960, avg_speed_mps: 8, avg_hr: 160, max_hr: 172, avg_cadence_spm: null, avg_cadence_rpm: 92, avg_power_w: 240, elevation_gain_m: 0 },
          ],
        }),
      }),
    );
    expect(v.intervals.map((i) => [i.label, i.speed, i.power])).toEqual([
      ["Warm-up", "12 mph", 110],
      ["Active", "17.9 mph", 240],
    ]);
  });

  it("compares with indoor rides of about the same length, by power and watts per heartbeat", () => {
    const earlier = (day: string, watts: number, hr: number) =>
      testRide({ local_date: day, started_at: `${day}T03:00:00Z`, activity_type: "indoor_cycling", duration_s: 1300, moving_duration_s: 1300, avg_power_w: watts, avg_hr: hr });
    const outdoor = testRide({ local_date: "2026-11-01", started_at: "2026-11-01T15:00:00Z", duration_s: 1250, moving_duration_s: 1250, avg_power_w: 300 });
    const pool = [earlier("2026-10-20", 120, 140), earlier("2026-10-25", 130, 145), earlier("2026-10-30", 135, 150), outdoor];
    const s = buildActivityView(rideInput({ activities: [...pool, ride] })).context.similar!;
    expect(s).toMatchObject({ sport: "ride", count: 3, paceRank: 1, powerDelta_w: 9, speedDelta_mph: null, hrDelta: 0 });
    // 139/145 against the median of 120/140, 130/145, 135/150: 0.897.
    expect(s.efficiencyPct).toBeCloseTo(6.9, 1);
  });

  it("counts the week's riding, not running", () => {
    const week = buildActivityView(rideInput({ activities: [testRun({ local_date: "2026-11-07" }), testRide({ local_date: "2026-11-05" }), ride] })).context.week;
    expect(week).toMatchObject({ sport: "ride", count: 2, hours: 1.3 });
  });
});

describe("helpers", () => {
  it("names activity types", () => {
    expect(typeLabel("treadmill_running")).toBe("Treadmill run");
    expect(typeLabel("kayaking")).toBe("Kayaking");
  });

  it("words a logged feel, rounding to Garmin's five steps", () => {
    expect([0, 25, 50, 75, 100].map(feelWord)).toEqual(["Very weak", "Weak", "Normal", "Strong", "Very strong"]);
  });

  it("has no pace while stopped", () => {
    expect(paceOf(0)).toBeNull();
    expect(paceOf(null)).toBeNull();
    expect(paceOf(METERS_PER_MILE / 600)).toBeCloseTo(600);
  });
});
