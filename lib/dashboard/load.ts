import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchActivities } from "@/lib/data/activities";
import { fetchActivityTypes } from "@/lib/data/activity-types";
import { fetchSteps } from "@/lib/data/daily-metrics";
import { fetchInjections } from "@/lib/data/injections";
import { fetchNutritionDays } from "@/lib/data/nutrition-days";
import type { Profile } from "@/lib/data/profiles";
import { fetchFirstDailyWeight, fetchWeightTrend, type DailyWeight } from "@/lib/data/weight-trend";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { heatmapWindow } from "@/lib/heatmap/window";
import { resolveRange } from "@/lib/range/resolve";
import type { DashboardData, RangeKey, WindowedData } from "./types";

/** profiles.program_start_date, or the first weigh-in, or today for a brand-new account. */
export function resolveProgramStart(
  profile: Profile,
  firstWeighIn: DailyWeight | null,
  today: LocalDate,
): LocalDate {
  return profile.program_start_date ?? firstWeighIn?.local_date ?? today;
}

async function loadWindow(
  supabase: SupabaseClient,
  userId: string,
  window: DayWindow,
): Promise<WindowedData> {
  const [nutritionDays, activities, steps] = await Promise.all([
    fetchNutritionDays(supabase, userId, window),
    fetchActivities(supabase, userId, window),
    fetchSteps(supabase, userId, window),
  ]);
  return { window, nutritionDays, activities, steps };
}

export interface LoadDashboardDataOptions {
  rangeKey: RangeKey;
  custom?: DayWindow;
}

/**
 * Loads everything the dashboard renders for one athlete. `profile` is the athlete whose
 * data is shown — for a coach that is the linked athlete, not the coach's own profile (see
 * lib/auth/viewer.ts). RLS is what actually authorizes this; the caller does not need to
 * re-check role here.
 */
export async function loadDashboardData(
  supabase: SupabaseClient,
  profile: Profile,
  options: LoadDashboardDataOptions,
): Promise<DashboardData> {
  const today = todayIn(profile.timezone);
  const [activityTypes, firstWeighIn, weightTrend, injections] = await Promise.all([
    fetchActivityTypes(supabase),
    fetchFirstDailyWeight(supabase, profile.id),
    fetchWeightTrend(supabase, profile.id),
    fetchInjections(supabase, profile.id),
  ]);

  const programStart = resolveProgramStart(profile, firstWeighIn, today);
  const dateRange = resolveRange(options.rangeKey, today, programStart, options.custom);

  const [heatmap, range] = await Promise.all([
    loadWindow(supabase, profile.id, heatmapWindow(programStart, today)),
    loadWindow(supabase, profile.id, dateRange),
  ]);

  return {
    profile,
    activityTypes,
    today,
    programStart,
    firstWeighIn,
    weightTrend,
    injections,
    heatmap,
    range,
    dateRange,
  };
}
