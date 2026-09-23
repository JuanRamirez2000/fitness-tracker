import type { DashboardData } from "@/lib/dashboard/types";
import { dayStartUtcMs, diffDays } from "@/lib/dates/calendar";
import { matchShots, type ShotStarState } from "@/lib/shots/match";

/** A range has to span this many days before the goal line's own vertical position is worth
 * stretching the y-domain for — otherwise a week or month view would squash the whole chart
 * toward the top of a scale most days never approach, just to fit a goal far off in the
 * future. Matches the design's own showGoal threshold. */
const GOAL_VISIBLE_RANGE_DAYS = 150;

export interface WeightTrendPoint {
  dateMs: number;
  local_date: string;
  weight: number;
  avg7: number;
}

export interface WeightTrendStar {
  dateMs: number;
  state: ShotStarState;
}

export interface WeightTrendLinePoint {
  dateMs: number;
  weight: number;
}

export interface WeightTrendChartData {
  points: WeightTrendPoint[];
  yDomain: [number, number];
  goal: number | null;
  /**
   * A straight reference line from program start to goal at the account's own
   * goal_pace_lb_per_week — real data, unlike the design mockup's hardcoded 1 lb/week. Null
   * when no pace (or no goal) is set, same gating progress-to-goal's KPI card already uses.
   */
  paceLine: { start: WeightTrendLinePoint; end: WeightTrendLinePoint } | null;
  /** null when program start falls outside the visible range, so nothing is drawn off-chart. */
  programStartMs: number | null;
  stars: WeightTrendStar[];
  fromLabel: string;
  toLabel: string;
}

export function buildWeightTrend(data: DashboardData): WeightTrendChartData | null {
  const { from, to } = data.dateRange;
  const rows = data.weightTrend.filter((r) => r.local_date >= from && r.local_date <= to);
  if (rows.length === 0) return null;

  const points: WeightTrendPoint[] = rows.map((r) => ({
    dateMs: dayStartUtcMs(r.local_date),
    local_date: r.local_date,
    weight: r.weight_lb,
    avg7: r.avg7_lb,
  }));

  const goal = data.profile.goal_weight_lb;
  const rangeDays = diffDays(to, from) + 1;
  const showGoal = goal !== null && rangeDays > GOAL_VISIBLE_RANGE_DAYS;

  const weights = points.map((p) => p.weight);
  let yMin = Math.min(...weights);
  let yMax = Math.max(...weights);
  if (showGoal) yMin = Math.min(yMin, goal);
  yMin -= 1;
  yMax += 1;

  const paceLine = buildPaceLine(data);

  const programStartMs = dayStartUtcMs(data.programStart);
  const inRange = programStartMs >= dayStartUtcMs(from) && programStartMs <= dayStartUtcMs(to);

  const stars = matchShots({
    programStart: data.programStart,
    shotWeekday: data.profile.shot_weekday,
    injectionDates: data.injections.map((i) => i.local_date),
    today: data.today,
    through: to,
  })
    .filter((s) => s.date >= from && s.date <= to)
    .map((s) => ({ dateMs: dayStartUtcMs(s.date), state: s.state }));

  return {
    points,
    yDomain: [yMin, yMax],
    goal,
    paceLine,
    programStartMs: inRange ? programStartMs : null,
    stars,
    fromLabel: from,
    toLabel: to,
  };
}

function buildPaceLine(data: DashboardData): WeightTrendChartData["paceLine"] {
  const pace = data.profile.goal_pace_lb_per_week;
  const goal = data.profile.goal_weight_lb;
  const startWeight = data.profile.start_weight_lb ?? data.firstWeighIn?.weight_lb ?? null;
  if (pace === null || pace <= 0 || goal === null || startWeight === null || startWeight <= goal) return null;

  const programStartMs = dayStartUtcMs(data.programStart);
  const weeksToGoal = (startWeight - goal) / pace;
  const paceEndMs = Math.min(programStartMs + weeksToGoal * 7 * 86_400_000, dayStartUtcMs(data.today));
  const elapsedWeeks = (paceEndMs - programStartMs) / 86_400_000 / 7;

  return {
    start: { dateMs: programStartMs, weight: startWeight },
    end: { dateMs: paceEndMs, weight: Math.max(goal, startWeight - elapsedWeeks * pace) },
  };
}
