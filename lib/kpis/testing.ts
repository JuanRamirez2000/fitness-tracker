import type { DailyTraining } from "@/lib/data/training";
import type { Activity } from "@/lib/data/activities";
import type { Profile } from "@/lib/data/profiles";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import type { DashboardData } from "@/lib/dashboard/types";

export const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
export const PROGRAM_START = "2026-09-17";
export const TODAY = "2026-09-20";

export function testProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: USER,
    display_name: "Test Athlete",
    timezone: "America/Los_Angeles",
    program_start_date: PROGRAM_START,
    goal_weight_lb: null,
    goal_pace_lb_per_week: null,
    start_weight_lb: null,
    shot_weekday: 4,
    hr_zone_bounds: null,
    ...over,
  };
}

export function trendRow(over: Partial<WeightTrendRow> & { local_date: string; weight_lb: number }): WeightTrendRow {
  return {
    user_id: USER,
    avg7_lb: over.weight_lb,
    n7: 7,
    raw_delta_lb: null,
    avg7_delta_lb: null,
    ...over,
  };
}

/** A minimal, valid DashboardData a KPI's compute() can run against. */
export function testDashboardData(over: Partial<DashboardData> = {}): DashboardData {
  return {
    tab: "weight",
    profile: testProfile(),
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend: [],
    injections: [],
    activities: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, steps: [] },
    weighIns: [],
    recovery: [],
    sleep: [],
    bodyComposition: [],
    training: [],
    runEfforts: [],
    summary: null,
    steps: [],
    dateRange: { key: "week", from: TODAY, to: TODAY },
    ...over,
  };
}

/** A 3-mile easy outdoor run on `local_date` at 130 bpm and 12:00/mi, unless overridden. Its
 * id comes from the date, so pass `id` for a second run on the same day. */
export function testRun(over: Partial<Activity> & { local_date: string }): Activity {
  return {
    id: `00000000-0000-4000-8000-${over.local_date.replaceAll("-", "").padStart(12, "0")}`,
    user_id: USER,
    source: "garmin",
    external_id: `run-${over.local_date}`,
    activity_type: "running",
    name: "Test Run",
    started_at: `${over.local_date}T15:00:00Z`,
    duration_s: 36 * 60,
    moving_duration_s: 36 * 60,
    distance_m: 3 * 1609.344,
    elevation_gain_m: 0,
    avg_speed_mps: 1609.344 / 720,
    avg_grade_adjusted_speed_mps: 1609.344 / 720,
    avg_hr: 130,
    max_hr: 150,
    avg_cadence_spm: 155,
    avg_stride_cm: 90,
    avg_ground_contact_ms: 280,
    calories: 400,
    aerobic_training_effect: 2.5,
    training_effect_label: "AEROBIC_BASE",
    training_load: 40,
    vo2max: 41,
    fastest_mile_s: 700,
    hr_zone_s: null,
    elevation_loss_m: 0,
    max_speed_mps: null,
    anaerobic_training_effect: null,
    avg_power_w: null,
    max_power_w: null,
    norm_power_w: null,
    avg_vertical_oscillation_cm: null,
    avg_vertical_ratio: null,
    min_temp_c: null,
    max_temp_c: null,
    body_battery_change: null,
    steps: null,
    ...over,
  };
}

/** A daily_training row with every value null except the date, unless overridden. */
export function testTraining(over: Partial<DailyTraining> & { local_date: string }): DailyTraining {
  return {
    acute_load: null,
    chronic_load: null,
    chronic_low: null,
    chronic_high: null,
    acwr: null,
    status: null,
    focus: null,
    focus_feedback: null,
    vo2max: null,
    race_5k_s: null,
    race_10k_s: null,
    race_half_s: null,
    race_marathon_s: null,
    fitness_age: null,
    fitness_age_achievable: null,
    chronological_age: null,
    fitness_age_factors: null,
    ...over,
  };
}
