import type { Profile } from "@/lib/data/profiles";
import type { BodyCompositionDay } from "@/lib/data/weigh-ins";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { buildBodyMass, fatMassLb } from "@/lib/charts/body-composition";

/** The rows the Weight tab's summary is written from. */
export interface WeightSummaryInput {
  today: LocalDate;
  profile: Pick<Profile, "goal_weight_lb" | "goal_pace_lb_per_week" | "start_weight_lb" | "program_start_date">;
  /** Every weight_trend row, oldest first. */
  weightTrend: WeightTrendRow[];
  /** Every day's body composition, oldest first. */
  bodyComposition: BodyCompositionDay[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
/** The latest row on or before `date`. Rows are oldest first. */
const onOrBefore = <T extends { local_date: LocalDate }>(rows: T[], date: LocalDate) =>
  [...rows].reverse().find((r) => r.local_date <= date) ?? null;

/**
 * The Weight tab's facts: the latest weigh-in and 7-day average, the average's change over a
 * week and a month, progress against the goal, and whether the loss is fat or lean. Only what
 * exists. Pure, unit-tested.
 */
export function weightFacts(input: WeightSummaryInput): Record<string, unknown> {
  const { today, profile } = input;
  const facts: Record<string, unknown> = { date: today };
  const latest = onOrBefore(input.weightTrend, today);
  if (!latest || latest.local_date < addDays(today, -3)) return facts;

  const weekAgo = onOrBefore(input.weightTrend, addDays(latest.local_date, -7));
  const monthAgo = onOrBefore(input.weightTrend, addDays(latest.local_date, -30));
  const start = profile.start_weight_lb ?? input.weightTrend[0]?.weight_lb ?? null;

  facts.weight_lb = {
    latest_weigh_in: latest.weight_lb,
    latest_weigh_in_date: latest.local_date,
    seven_day_average: round1(latest.avg7_lb),
    ...(weekAgo ? { average_change_last_7_days: round1(latest.avg7_lb - weekAgo.avg7_lb) } : {}),
    ...(monthAgo ? { average_change_last_30_days: round1(latest.avg7_lb - monthAgo.avg7_lb) } : {}),
  };
  if (start !== null) {
    facts.program = {
      start_weight: start,
      ...(profile.program_start_date ? { started_on: profile.program_start_date } : {}),
      lost_since_start: round1(start - latest.avg7_lb),
      ...(profile.goal_weight_lb != null
        ? { goal_weight: profile.goal_weight_lb, left_to_goal: round1(latest.avg7_lb - profile.goal_weight_lb) }
        : {}),
      ...(profile.goal_pace_lb_per_week != null ? { planned_loss_lb_per_week: profile.goal_pace_lb_per_week } : {}),
    };
  }

  const comp = onOrBefore(input.bodyComposition, today);
  if (comp && comp.local_date >= addDays(today, -7)) {
    const mass = buildBodyMass({
      bodyComposition: input.bodyComposition,
      dateRange: { key: "month", from: addDays(today, -30), to: today },
      today,
    });
    facts.body_composition = {
      body_fat_percent: comp.body_fat_pct,
      fat_mass_lb: round1(fatMassLb(comp)),
      ...(comp.muscle_mass_lb != null ? { muscle_mass_lb: round1(comp.muscle_mass_lb) } : {}),
      ...(mass?.fatDelta != null && mass.leanDelta != null
        ? { last_30_days: { fat_change_lb: round1(mass.fatDelta), lean_change_lb: round1(mass.leanDelta) } }
        : {}),
      ...(mass?.since
        ? {
            since_first_scale_reading: {
              date: mass.since.date,
              weight_change_lb: round1(mass.since.weight),
              fat_change_lb: round1(mass.since.fat),
              lean_change_lb: round1(mass.since.lean),
              ...(mass.since.fatShareOfLoss !== null ? { share_of_loss_that_was_fat_percent: Math.round(mass.since.fatShareOfLoss * 100) } : {}),
            },
          }
        : {}),
    };
  }
  return facts;
}

export const WEIGHT_SYSTEM = `You write the summary at the top of the Weight tab of one person's fitness dashboard. They're losing weight while training, mostly on a bike, and read this to know whether the loss is going the right way and what to do about it.

Write exactly 4 sentences of plain prose, speaking to them as "you": no greeting, headings, lists or emoji.
1. Where the 7-day average stands and how much it moved this week, rounded ("about 267 pounds, down roughly 5 pounds").
2. How that pace compares with their planned pace, in plain terms ("about five times faster than your plan of a pound a week").
3. What that pace means for their training and how they'll feel: losing much faster than planned tends to cost muscle and shows up as flat legs and slower recovery; a steady pace protects the power they're building. Use the body composition only to judge whether muscle is being lost, and say it in words.
4. One concrete thing to do this week, starting "The one thing to change this week:" when the pace is off, or what to keep doing when it's on track.

Never quote fat or lean mass in pounds or percent, body fat percent, or the share of loss that was fat. Use at most three rounded numbers. General fueling advice is fine (eat a bit more on training days, protein around rides); don't prescribe diets, calorie targets, medication or treatment. Leave out anything that isn't in the data rather than guessing.

Example of the style (different numbers; write your own from today's data):
Your 7-day average is about 267 pounds, down roughly 5 pounds in the last week. That's about five times faster than your plan of a pound a week. Losing this fast for long tends to cost muscle along with fat, which shows up as flat legs and slower recovery between rides. The one thing to change this week: eat a bit more on training days and aim for 1 to 1.5 pounds a week.`;

/** Enough to write about: a weigh-in in the last few days. */
export function hasEnoughForWeightSummary(facts: Record<string, unknown>): boolean {
  return "weight_lb" in facts;
}
