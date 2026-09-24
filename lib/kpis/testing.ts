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
    role: "owner",
    timezone: "America/Los_Angeles",
    program_start_date: PROGRAM_START,
    goal_weight_lb: null,
    goal_pace_lb_per_week: null,
    start_weight_lb: null,
    shot_weekday: 4,
    steps_goal: 10000,
    calorie_target_kcal: null,
    dashboard_layout: null,
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
    profile: testProfile(),
    activityTypes: [],
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend: [],
    injections: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, nutritionDays: [], activities: [], steps: [] },
    range: { window: { from: TODAY, to: TODAY }, nutritionDays: [], activities: [], steps: [] },
    dateRange: { key: "week", from: TODAY, to: TODAY },
    ...over,
  };
}
