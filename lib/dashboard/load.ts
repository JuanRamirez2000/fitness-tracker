import type { Profile } from "@/lib/data/profiles";
import { fetchWeighIns, fetchWeightTrend } from "@/lib/data/queries";
import { firstDailyWeight, type DailyWeight } from "@/lib/data/weight-trend";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { heatmapWindow } from "@/lib/heatmap/window";
import { resolveRange } from "@/lib/range/resolve";
import type { DashboardData, RangeKey } from "./types";

/** profiles.program_start_date, or the first weigh-in, or today for a brand-new account. */
export function resolveProgramStart(
  profile: Profile,
  firstWeighIn: DailyWeight | null,
  today: LocalDate,
): LocalDate {
  return profile.program_start_date ?? firstWeighIn?.local_date ?? today;
}

export interface LoadDashboardDataOptions {
  rangeKey: RangeKey;
  custom?: DayWindow;
}

/** Loads everything the dashboard renders. Callers have already checked the session. */
export async function loadDashboardData(profile: Profile, options: LoadDashboardDataOptions): Promise<DashboardData> {
  const today = todayIn(profile.timezone);
  const weightTrend = await fetchWeightTrend(profile.id);
  const firstWeighIn = firstDailyWeight(weightTrend);
  const programStart = resolveProgramStart(profile, firstWeighIn, today);
  const dateRange = resolveRange(options.rangeKey, today, programStart, options.custom);

  return {
    profile,
    today,
    programStart,
    firstWeighIn,
    weightTrend,
    heatmap: { window: heatmapWindow(programStart, today) },
    weighIns: await fetchWeighIns(profile.id, dateRange),
    dateRange,
  };
}
