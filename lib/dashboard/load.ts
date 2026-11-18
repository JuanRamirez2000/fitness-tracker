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

/** The strip's mornings (readiness, sleep) on the Weight tab. */
const QUICK_LOOK_DAYS = 8;

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
 * loaded: every tab's heatmap reads them (its caption and shot stars). Both tabs carry the
 * quick-look strip (components/dashboard/quick-look.tsx), which reads activities, recovery,
 * sleep and training. */
export function tabNeeds(tab: TabKey): {
  activities: boolean;
  steps: boolean;
  weighIns: boolean;
  recovery: boolean;
  bodyComposition: boolean;
  training: boolean;
} {
  return {
    activities: true, // every training view, the strip's week; run ticks on the weight trend
    steps: tab === "training", // the Steps card and the steps heatmap
    weighIns: tab === "weight",
    recovery: true, // daily_recovery and sleep_nights: the readiness hero and the week (Training); the strip
    bodyComposition: tab === "weight",
    training: true, // daily_training: VO2 max, load, the plan cards and records; the strip's load ratio
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
  // Training: that, plus the picked week and the week before it (its readiness comparison).
  // Weight: only the strip's last few mornings.
  const weekFrom = addDays(shell.week, -7);
  const weekTo = addDays(shell.week, 6);
  const rangeTo = dateRange.to > today ? dateRange.to : today;
  const recoverySpan =
    shell.tab === "training"
      ? { from: weekFrom < earliest ? weekFrom : earliest, to: weekTo > rangeTo ? weekTo : rangeTo }
      : { from: addDays(today, -QUICK_LOOK_DAYS), to: today };
  const activityRows = needs.activities ? fetchActivities(profile.id) : Promise.resolve([]);
  // The brick runs' detail waits on the activities (the pairing is by start and end times).
  const brickRunRows =
    shell.tab === "training" ? activityRows.then((rows) => fetchBrickRunDetails(profile.id, findBricks(rows).map((b) => b.run.id))) : Promise.resolve([]);
  const planFrom = addDays(shell.week < today ? shell.week : today, -PLAN_HISTORY_BACK_DAYS);
  const training = shell.tab === "training";
  const [weightTrend, injections, moodLogRows, activities, brickRuns, weighIns, allSteps, recovery, sleep, bodyComposition, trainingRows, summary, runEfforts, planner, planned, weeklySummary, planHistory] =
    await Promise.all([
      fetchWeightTrend(profile.id),
      fetchInjections(profile.id),
      moodLogs,
      activityRows,
      brickRunRows,
      needs.weighIns ? fetchWeighIns(profile.id, dateRange) : [],
      needs.steps ? fetchSteps(profile.id, stepsSpan) : [],
      fetchRecovery(profile.id, recoverySpan),
      fetchSleepNights(profile.id, recoverySpan),
      needs.bodyComposition ? fetchBodyComposition(profile.id) : [],
      fetchTraining(profile.id, recoverySpan.to > today ? recoverySpan.to : today),
      fetchDailySummary(profile.id, today, shell.tab),
      training ? fetchRunEfforts(profile.id) : [],
      training ? loadPlanner(profile, today) : null,
      training ? fetchPlannedWorkouts(profile.id, { from: shell.week, to: weekTo }) : [],
      training ? fetchWeeklySummary(profile.id, shell.week) : null,
      fetchPlannedWorkouts(profile.id, { from: planFrom, to: addDays(today, PLAN_HISTORY_AHEAD_DAYS) }),
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
