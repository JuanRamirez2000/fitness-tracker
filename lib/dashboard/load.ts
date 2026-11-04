import type { Profile } from "@/lib/data/profiles";
import { fetchActivities, fetchInjections, fetchSteps, fetchWeighIns, fetchWeightTrend } from "@/lib/data/queries";
import { firstDailyWeight, type DailyWeight } from "@/lib/data/weight-trend";
import { isInRange } from "@/lib/heatmap/cell-state";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { heatmapWindow } from "@/lib/heatmap/window";
import { resolveRange } from "@/lib/range/resolve";
import type { DashboardData, RangeKey, TabKey } from "./types";

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
  tab: TabKey;
}

/** Which of the optional loads each tab renders. weightTrend and injections are always
 * loaded: the program start (and so every range) is derived from them. */
export function tabNeeds(tab: TabKey): { activities: boolean; steps: boolean; weighIns: boolean } {
  return {
    activities: tab === "weight" || tab === "training", // run ticks on the weight trend; every running view
    steps: tab === "training",
    weighIns: tab === "weight",
  };
}

/** Loads what the active tab renders. Callers have already checked the session. */
export async function loadDashboardData(profile: Profile, options: LoadDashboardDataOptions): Promise<DashboardData> {
  const today = todayIn(profile.timezone);
  const needs = tabNeeds(options.tab);
  const [weightTrend, injections, activities] = await Promise.all([
    fetchWeightTrend(profile.id),
    fetchInjections(profile.id),
    needs.activities ? fetchActivities(profile.id) : [],
  ]);
  const firstWeighIn = firstDailyWeight(weightTrend);
  const programStart = resolveProgramStart(profile, firstWeighIn, today);
  const dateRange = resolveRange(options.rangeKey, today, programStart, options.custom);
  const window = heatmapWindow(programStart, today);
  // One steps query covering both the heatmap window and the selected range, split below.
  const stepsSpan = {
    from: dateRange.from < window.from ? dateRange.from : window.from,
    to: dateRange.to > window.to ? dateRange.to : window.to,
  };
  const [weighIns, allSteps] = await Promise.all([
    needs.weighIns ? fetchWeighIns(profile.id, dateRange) : [],
    needs.steps ? fetchSteps(profile.id, stepsSpan) : [],
  ]);

  return {
    tab: options.tab,
    profile,
    today,
    programStart,
    firstWeighIn,
    weightTrend,
    injections,
    activities,
    heatmap: { window, steps: allSteps.filter((s) => isInRange(s.local_date, window)) },
    steps: allSteps.filter((s) => isInRange(s.local_date, dateRange)),
    weighIns,
    dateRange,
  };
}
