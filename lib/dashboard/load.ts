import { findBricks } from "@/lib/charts/bricks";
import type { MoodLog } from "@/lib/data/mood";
import type { Profile } from "@/lib/data/profiles";
import {
  fetchActivities,
  fetchBrickRunDetails,
  fetchBodyComposition,
  fetchDailySummary,
  fetchInjections,
  fetchMoodLogs,
  fetchRecovery,
  fetchRunEfforts,
  fetchSleepNights,
  fetchSteps,
  fetchTraining,
  fetchWeighIns,
  fetchWeeklySummary,
  fetchWeightTrend,
} from "@/lib/data/queries";
import type { DailyWeight } from "@/lib/data/weight-trend";
import { isInRange } from "@/lib/heatmap/cell-state";
import { addDays, type DayWindow, type LocalDate } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { heatmapWindow } from "@/lib/heatmap/window";
import { resolveRange } from "@/lib/range/resolve";
import { DEFAULT_SPORT, type SportFilter } from "@/lib/sport";
import { parseWeekParam } from "@/lib/progress/week";
import { loadPlanner } from "@/lib/workouts/service";
import { fetchPlannedWorkouts } from "@/lib/workouts/store";
import type { DashboardData, DashboardShell, RangeKey, TabKey } from "./types";

/** Recovery and sleep load at least this far back, for the Daily feel cards' baselines. */
const RECOVERY_HISTORY_DAYS = 35;

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
  sport?: SportFilter;
  /** The Progress tab's `?week=`, raw. */
  week?: string;
}

/** Which of the optional loads each tab renders. weightTrend and injections are always
 * loaded: every tab's heatmap reads them (its caption and shot stars). */
export function tabNeeds(tab: TabKey): {
  activities: boolean;
  steps: boolean;
  weighIns: boolean;
  recovery: boolean;
  bodyComposition: boolean;
  training: boolean;
} {
  return {
    activities: tab === "weight" || tab === "training" || tab === "progress", // run ticks on the weight trend; every running view; Progress's load and hours
    steps: tab === "today" || tab === "training", // the Steps card (Daily feel); the steps heatmap (Training)
    weighIns: tab === "weight",
    recovery: tab === "today" || tab === "progress", // daily_recovery and sleep_nights
    bodyComposition: tab === "weight",
    training: tab === "training" || tab === "weight", // daily_training (Weight: Garmin's FTP, for watts per kilo)
  };
}

/**
 * The part of the page known after the first query (profile and first weigh-in): the tab, the
 * dates, and the range. The header renders from this while the tab's rows load.
 */
export function resolveShell(
  profile: Profile,
  firstWeighIn: DailyWeight | null,
  options: LoadDashboardDataOptions,
  today: LocalDate = todayIn(profile.timezone),
): DashboardShell {
  const programStart = resolveProgramStart(profile, firstWeighIn, today);
  const dateRange = resolveRange(options.rangeKey, today, programStart, options.custom);
  const week = parseWeekParam(options.week, today, programStart);
  return { tab: options.tab, sport: options.sport ?? DEFAULT_SPORT, profile, today, programStart, firstWeighIn, dateRange, week };
}

/** Loads what the active tab renders, every query in one parallel batch (the range is already
 * known from the shell). Callers have already checked the session. */
export async function loadDashboardData(
  shell: DashboardShell,
  /** Already started by the page (the header reads it too); fetched here when not given. */
  moodLogs: Promise<MoodLog[]> = fetchMoodLogs(shell.profile.id),
): Promise<DashboardData> {
  const { profile, today, programStart, dateRange } = shell;
  const needs = tabNeeds(shell.tab);
  const window = heatmapWindow(programStart, today);
  // One steps query covering both the heatmap window and the selected range, split below.
  const stepsSpan = {
    from: dateRange.from < window.from ? dateRange.from : window.from,
    to: dateRange.to > window.to ? dateRange.to : window.to,
  };
  // Recovery, sleep and training cover the range and always today too: the hero and the
  // "latest" stats are about today whatever range is selected.
  // At least the last RECOVERY_HISTORY_DAYS too, whatever the range: the top cards compare this
  // morning against a week or a month (the charts filter to the range themselves).
  const historyFrom = addDays(today, -RECOVERY_HISTORY_DAYS);
  // And the heatmap's year, for the recovery calendar.
  const earliest = [dateRange.from, historyFrom, window.from].sort()[0];
  // Progress needs only its week and the week before (its readiness comparison).
  const recoverySpan =
    shell.tab === "progress"
      ? { from: addDays(shell.week, -7), to: addDays(shell.week, 6) }
      : { from: earliest, to: dateRange.to > today ? dateRange.to : today };
  const activityRows = needs.activities ? fetchActivities(profile.id) : Promise.resolve([]);
  // The brick runs' detail waits on the activities (the pairing is by start and end times).
  const brickRunRows =
    shell.tab === "training" ? activityRows.then((rows) => fetchBrickRunDetails(profile.id, findBricks(rows).map((b) => b.run.id))) : Promise.resolve([]);
  const [weightTrend, injections, moodLogRows, activities, brickRuns, weighIns, allSteps, recovery, sleep, bodyComposition, training, summary, runEfforts, planner, planned, weeklySummary] =
    await Promise.all([
      fetchWeightTrend(profile.id),
      fetchInjections(profile.id),
      moodLogs,
      activityRows,
      brickRunRows,
      needs.weighIns ? fetchWeighIns(profile.id, dateRange) : [],
      needs.steps ? fetchSteps(profile.id, stepsSpan) : [],
      needs.recovery ? fetchRecovery(profile.id, recoverySpan) : [],
      needs.recovery ? fetchSleepNights(profile.id, recoverySpan) : [],
      needs.bodyComposition ? fetchBodyComposition(profile.id) : [],
      needs.training ? fetchTraining(profile.id, recoverySpan.to) : [],
      // Progress's own weekly review comes later (docs/plan-progress-tab.md, step 4).
      shell.tab === "progress" ? null : fetchDailySummary(profile.id, today, shell.tab),
      needs.training ? fetchRunEfforts(profile.id) : [],
      shell.tab === "training" ? loadPlanner(profile, today) : null,
      shell.tab === "progress" ? fetchPlannedWorkouts(profile.id, { from: shell.week, to: addDays(shell.week, 6) }) : [],
      shell.tab === "progress" ? fetchWeeklySummary(profile.id, shell.week) : null,
    ]);

  return {
    ...shell,
    weightTrend,
    injections,
    moodLogs: moodLogRows,
    activities,
    heatmap: { window, steps: allSteps.filter((s) => isInRange(s.local_date, window)) },
    steps: allSteps.filter((s) => isInRange(s.local_date, dateRange)),
    weighIns,
    recovery,
    sleep,
    bodyComposition,
    training,
    summary,
    runEfforts,
    brickRuns,
    planner,
    planned,
    weeklySummary,
  };
}
