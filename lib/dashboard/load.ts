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

/** The plan progress cards look this far back for a plan's first weeks, and ahead for its end. */
const PLAN_HISTORY_BACK_DAYS = 26 * 7;
const PLAN_HISTORY_AHEAD_DAYS = 8 * 7;

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

/** Which of the optional loads each tab renders. weightTrend, injections and mood logs are
 * always loaded (small, and read by heatmap captions and chart markers everywhere). */
export function tabNeeds(tab: TabKey): {
  activities: boolean;
  steps: boolean;
  weighIns: boolean;
  recovery: boolean;
  bodyComposition: boolean;
  training: boolean;
  /** The plans, the planner, the week's sessions and its review (Home); plan rows for Log's day table. */
  plans: boolean;
  /** Run best efforts: records (Home, Log) and the best efforts card (Training). */
  runEfforts: boolean;
} {
  return {
    activities: true, // every training view; run ticks on the weight trend; Log's tables
    steps: tab === "recovery" || tab === "log", // average steps, the Steps card, the steps heatmap
    weighIns: tab === "weight",
    recovery: tab === "recovery" || tab === "log", // daily_recovery and sleep_nights
    bodyComposition: tab === "weight",
    training: tab !== "recovery", // daily_training: VO2 max, load, plans, records; Garmin's FTP for watts per kilo
    plans: tab === "home" || tab === "log",
    runEfforts: tab === "home" || tab === "training" || tab === "log",
  };
}

/** The daily summary each tab shows, by its stored key: Home shows the Training one. */
const SUMMARY_FOR: Partial<Record<TabKey, "training" | "weight">> = { home: "training", weight: "weight" };

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
  // Plus the picked week and the week before it (its readiness comparison).
  const weekFrom = addDays(shell.week, -7);
  const weekTo = addDays(shell.week, 6);
  const rangeTo = dateRange.to > today ? dateRange.to : today;
  const recoverySpan = { from: weekFrom < earliest ? weekFrom : earliest, to: weekTo > rangeTo ? weekTo : rangeTo };
  const activityRows = needs.activities ? fetchActivities(profile.id) : Promise.resolve([]);
  // The brick runs' detail waits on the activities (the pairing is by start and end times).
  const brickRunRows =
    shell.tab === "training" ? activityRows.then((rows) => fetchBrickRunDetails(profile.id, findBricks(rows).map((b) => b.run.id))) : Promise.resolve([]);
  // Log's day table shows planned vs done over the range too.
  const planBase = [shell.week < today ? shell.week : today, dateRange.from].sort()[0];
  const planFrom = addDays(planBase, -PLAN_HISTORY_BACK_DAYS);
  const home = shell.tab === "home";
  const summaryKey = SUMMARY_FOR[shell.tab];
  const [weightTrend, injections, moodLogRows, activities, brickRuns, weighIns, allSteps, recovery, sleep, bodyComposition, trainingRows, summary, runEfforts, planner, planned, weeklySummary, planHistory] =
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
      needs.training ? fetchTraining(profile.id, recoverySpan.to > today ? recoverySpan.to : today) : [],
      summaryKey ? fetchDailySummary(profile.id, today, summaryKey) : null,
      needs.runEfforts ? fetchRunEfforts(profile.id) : [],
      home ? loadPlanner(profile, today) : null,
      home ? fetchPlannedWorkouts(profile.id, { from: shell.week, to: weekTo }) : [],
      home ? fetchWeeklySummary(profile.id, shell.week) : null,
      needs.plans ? fetchPlannedWorkouts(profile.id, { from: planFrom, to: addDays(today, PLAN_HISTORY_AHEAD_DAYS) }) : [],
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
    training: trainingRows,
    summary,
    runEfforts,
    brickRuns,
    planner,
    planned,
    weeklySummary,
    planHistory,
  };
}
