import type { DashboardData } from "@/lib/dashboard/types";
import { MIN_AVG7_SAMPLES, type WeightTrendRow } from "@/lib/data/weight-trend";
import { addDays, diffDays, startOfWeek, type LocalDate } from "@/lib/dates/calendar";
import { weeklyBuckets } from "./weekly-buckets";

/** The current pace is fitted over this many days of 7-day averages. */
export const PACE_WINDOW_DAYS = 28;
/** A pace fit needs this many days of averages, spread over at least half the window. */
const MIN_PACE_ROWS = 8;
/** Losing slower than this (lb a week) projects no date: the line is effectively flat. */
const MIN_PROJECTED_PACE = 0.05;
/** Dates further out than this aren't projected; they'd mean little. */
const MAX_HORIZON_DAYS = 3 * 365;
/** The weekly chart always shows at least this many weeks, whatever the range. */
const MIN_WEEKS = 8;

type Data = Pick<DashboardData, "weightTrend" | "profile" | "programStart" | "firstWeighIn" | "today" | "dateRange">;

/**
 * Pounds lost per week (positive: losing) from a least-squares line through the 7-day averages
 * of the PACE_WINDOW_DAYS ending `end`. A fit rather than first-vs-last, so one heavy weigh-in at
 * either end doesn't swing it. Null without enough averages to fit.
 */
export function currentPace(rows: WeightTrendRow[], end: LocalDate): number | null {
  const from = addDays(end, -(PACE_WINDOW_DAYS - 1));
  const window = rows.filter((r) => r.local_date >= from && r.local_date <= end);
  if (window.length < MIN_PACE_ROWS || diffDays(window[window.length - 1].local_date, window[0].local_date) < PACE_WINDOW_DAYS / 2) return null;
  const xs = window.map((r) => diffDays(r.local_date, from));
  const ys = window.map((r) => r.avg7_lb);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  return -(sxy / sxx) * 7;
}

/** The day `weight` lb at `pace` lb a week (losing) from `from` reaches `goal`, or null if it won't within the horizon. */
function etaDate(from: LocalDate, weight: number, goal: number, pace: number | null): LocalDate | null {
  if (weight <= goal) return from;
  if (pace === null || pace < MIN_PROJECTED_PACE) return null;
  const days = Math.ceil(((weight - goal) / pace) * 7);
  return days > MAX_HORIZON_DAYS ? null : addDays(from, days);
}

export interface GoalProjection {
  goal: number;
  latest: { date: LocalDate; avg: number };
  leftToGoal: number;
  /** Lb lost a week lately (negative: gaining), or null without enough averages. */
  pace: number | null;
  /** When the current pace reaches the goal; null when it isn't losing, or not within 3 years. */
  eta: LocalDate | null;
  /** The plan, when a pace is set: its line from the start, its goal date, and where it puts you today. */
  plan: {
    pace: number;
    start: { date: LocalDate; weight: number };
    goalDate: LocalDate;
    /** Where the plan's line is on the latest weigh-in's day. */
    target: number;
    /** Positive: lighter than the plan (ahead); negative: behind. */
    ahead: number;
    /** Keeping to the plan's pace from now. */
    etaFromNow: LocalDate | null;
  } | null;
  /** The 7-day average since the program started, oldest first. */
  history: { date: LocalDate; avg: number }[];
}

/** Where the weight is heading: today's pace to the goal against the plan's. Null without a goal or a weigh-in. Pure. */
export function buildGoalProjection(data: Data): GoalProjection | null {
  const goal = data.profile.goal_weight_lb;
  const rows = data.weightTrend.filter((r) => r.local_date <= data.today);
  const last = rows.at(-1);
  if (goal === null || !last) return null;

  const pace = currentPace(rows, last.local_date);
  const startWeight = data.profile.start_weight_lb ?? data.firstWeighIn?.weight_lb ?? null;
  const planPace = data.profile.goal_pace_lb_per_week;
  let plan: GoalProjection["plan"] = null;
  if (planPace !== null && planPace > 0 && startWeight !== null && startWeight > goal) {
    const weeksToGoal = (startWeight - goal) / planPace;
    const elapsedWeeks = Math.max(0, diffDays(last.local_date, data.programStart)) / 7;
    const target = Math.max(goal, startWeight - elapsedWeeks * planPace);
    plan = {
      pace: planPace,
      start: { date: data.programStart, weight: startWeight },
      goalDate: addDays(data.programStart, Math.ceil(weeksToGoal * 7)),
      target,
      ahead: target - last.avg7_lb,
      etaFromNow: etaDate(last.local_date, last.avg7_lb, goal, planPace),
    };
  }

  return {
    goal,
    latest: { date: last.local_date, avg: last.avg7_lb },
    leftToGoal: last.avg7_lb - goal,
    pace,
    eta: etaDate(last.local_date, last.avg7_lb, goal, pace),
    plan,
    history: rows.filter((r) => r.local_date >= data.programStart).map((r) => ({ date: r.local_date, avg: r.avg7_lb })),
  };
}

export interface WeekLoss {
  /** The week's first day (Sunday), or the window's first day. */
  label: LocalDate;
  /** The last day the week's change is measured to (today, in the week still under way). */
  end: LocalDate;
  /** Lb the 7-day average dropped over the week (negative: it rose). */
  lost: number;
  /** The week still under way. */
  partial: boolean;
}

export interface WeeklyLossData {
  weeks: WeekLoss[];
  /** The plan's lb a week, when set. */
  pace: number | null;
  /** Complete weeks that lost at least the plan's pace. */
  onPlan: number;
  complete: number;
  /** Mean lb lost per complete week. */
  avgLost: number | null;
}

/** The 7-day average on the last weigh-in on or before `date`, no older than `maxAgeDays`. */
function avgAsOf(rows: WeightTrendRow[], date: LocalDate, maxAgeDays: number): number | null {
  const r = [...rows].reverse().find((row) => row.local_date <= date);
  return r && diffDays(date, r.local_date) <= maxAgeDays ? r.avg7_lb : null;
}

/**
 * Each calendar week's change in the 7-day average, against the plan's pace: the range's weeks,
 * and at least the last 8. A week with no weigh-in near its end, or none before it, is left out.
 * Pure.
 */
export function buildWeeklyLoss(data: Data): WeeklyLossData | null {
  // Averages still warming up (the first days of data) swing on one weigh-in; a week measured
  // from one would show a gain or loss that never happened.
  const rows = data.weightTrend.filter((r) => r.local_date <= data.today && r.n7 >= MIN_AVG7_SAMPLES);
  if (rows.length < 2) return null;
  const minFrom = addDays(data.today, -(MIN_WEEKS * 7 - 1));
  const to = data.dateRange.to < data.today ? data.dateRange.to : data.today;
  // From a Sunday, so every week but the one under way is a whole week.
  const from = startOfWeek(data.dateRange.from < minFrom ? data.dateRange.from : minFrom);

  const weeks = weeklyBuckets({ from, to }).flatMap((days): WeekLoss[] => {
    const first = days[0];
    const end = days[days.length - 1];
    const before = avgAsOf(rows, addDays(first, -1), 6);
    const after = avgAsOf(rows, end, 6);
    if (before === null || after === null) return [];
    return [{ label: first, end, lost: before - after, partial: end === data.today && days.length < 7 }];
  });
  if (!weeks.length) return null;

  const pace = data.profile.goal_pace_lb_per_week;
  const complete = weeks.filter((w) => !w.partial);
  return {
    weeks,
    pace: pace !== null && pace > 0 ? pace : null,
    onPlan: pace ? complete.filter((w) => w.lost >= pace).length : 0,
    complete: complete.length,
    avgLost: complete.length ? complete.reduce((s, w) => s + w.lost, 0) / complete.length : null,
  };
}
