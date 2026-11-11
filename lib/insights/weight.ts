/**
 * The Weight tab's insights: how fast the weight is coming off against the plan and what that
 * pace does to training, what the loss means on the bike (climbing at the same power), and one
 * verdict on whether muscle is holding up. Built on the same facts as the Weight summary
 * (lib/summary/weight.ts), so the cards and the summary never disagree. Pure, unit-tested.
 */
import type { DashboardData } from "@/lib/dashboard/types";
import { workingFtp } from "@/lib/kpis/ftp";
import { weightFacts } from "@/lib/summary/weight";
import { fmt1, type Insight } from "./types";

/** Bike, shoes, bottles and kit: the extra weight that climbs with you (an assumption, shown). */
export const BIKE_AND_GEAR_LB = 22;
const LB_PER_KG = 2.20462;
/** Under this much change over 30 days, the composition split is mostly scale noise. */
const MIN_LOSS_TO_JUDGE_LB = 1.5;

interface WeightFacts {
  weight_lb?: { seven_day_average: number; average_change_last_7_days?: number; average_change_last_30_days?: number };
  program?: { start_weight: number; lost_since_start: number; goal_weight?: number; planned_loss_lb_per_week?: number };
  body_composition?: { last_30_days?: { fat_change_lb: number; lean_change_lb: number } };
}

type Data = Pick<DashboardData, "today" | "profile" | "weightTrend" | "bodyComposition" | "activities" | "training">;

const factsOf = (data: Data) => weightFacts(data) as WeightFacts;

/** Percent faster up a climb at the same power, going from `from` lb to `to` lb of rider: on a
 * steady climb almost all the power lifts rider plus bike, so time scales with total weight. */
export function climbGainPct(from: number, to: number, gear = BIKE_AND_GEAR_LB): number {
  return (1 - (to + gear) / (from + gear)) * 100;
}

export function paceInsight(data: Data): Insight | null {
  const f = factsOf(data);
  const week = f.weight_lb?.average_change_last_7_days;
  if (week === undefined || !f.weight_lb) return null;
  const lossWeek = -week;
  const month = f.weight_lb.average_change_last_30_days;
  const perWeekMonth = month !== undefined ? -month / (30 / 7) : null;
  const plan = f.program?.planned_loss_lb_per_week ?? null;
  const numbers = [
    { label: "7-day average", value: `${fmt1(f.weight_lb.seven_day_average)} lb` },
    { label: "Change this week", value: `${week > 0 ? "+" : ""}${fmt1(week)} lb` },
    ...(perWeekMonth !== null ? [{ label: "Last 30 days", value: `${fmt1(perWeekMonth)} lb a week` }] : []),
    ...(plan !== null ? [{ label: "Your plan", value: `${fmt1(plan)} lb a week` }] : []),
  ];
  const target = plan ?? 1;
  if (lossWeek > Math.max(target * 2, 2)) {
    return {
      id: "pace",
      topic: "Pace of loss",
      tone: "act",
      headline: "Losing faster than planned",
      effect: `About ${Math.round(lossWeek)} pounds came off this week${plan !== null ? `, roughly ${Math.round(lossWeek / plan)} times your plan` : ""}. Losing this fast tends to take muscle along with fat, which shows up as flat legs and slower recovery between rides.`,
      lever: `Eat a bit more on training days and aim for ${fmt1(target)} to ${fmt1(target + 0.5)} pounds a week.`,
      numbers,
    };
  }
  if (lossWeek < 0) {
    return {
      id: "pace",
      topic: "Pace of loss",
      tone: "watch",
      headline: "The trend ticked up this week",
      effect: "One week up is usually water, salt or a hard training block, not fat; it only matters if it holds for two or three weeks.",
      lever: "Keep fueling your rides and look at rest-day portions if it's still up next week.",
      numbers,
    };
  }
  if (lossWeek < target * 0.5) {
    return {
      id: "pace",
      topic: "Pace of loss",
      tone: "watch",
      headline: "Slower than planned",
      effect: "A slow week costs you nothing on the bike, and the scale often moves in steps; judge it over a few weeks.",
      lever: "Trim rest-day portions rather than cutting fuel around your rides.",
      numbers,
    };
  }
  return {
    id: "pace",
    topic: "Pace of loss",
    tone: "good",
    headline: "Right on pace",
    effect: "A steady loss like this comes mostly from fat and leaves your power and recovery intact.",
    lever: "Keep doing what you're doing.",
    numbers,
  };
}

export function powerToWeightInsight(data: Data): Insight | null {
  const f = factsOf(data);
  if (!f.weight_lb || !f.program) return null;
  const now = f.weight_lb.seven_day_average;
  const start = f.program.start_weight;
  const gained = climbGainPct(start, now);
  const per10 = climbGainPct(now, now - 10);
  const ftp = workingFtp(data);
  const wkg = ftp ? ftp.watts / (now / LB_PER_KG) : null;
  const goal = f.program.goal_weight;
  const numbers = [
    ...(ftp && wkg !== null ? [{ label: "Power to weight", value: `${wkg.toFixed(2)} W/kg at ${ftp.watts} W${ftp.source === "estimate" ? " (from your best 20 min)" : ""}` }] : []),
    ...(ftp && goal !== undefined ? [{ label: "At your goal weight", value: `${(ftp.watts / (goal / LB_PER_KG)).toFixed(2)} W/kg` }] : []),
    { label: "Lost since start", value: `${fmt1(start - now)} lb` },
    { label: "Bike and gear assumed", value: `${BIKE_AND_GEAR_LB} lb` },
  ];
  if (gained <= 0.5) {
    return {
      id: "w-kg",
      topic: "On the bike",
      tone: "watch",
      headline: "No climbing gain yet",
      effect: `Every 10 pounds you lose makes climbs about ${Math.round(per10)}% quicker at the same power.`,
      lever: "Keep one or two harder rides a week so your power holds while the weight comes down.",
      numbers,
    };
  }
  return {
    id: "w-kg",
    topic: "On the bike",
    tone: "good",
    headline: `Climbs are about ${Math.round(gained)}% faster than at your start weight`,
    effect: `That's at the same power, from the weight alone, and every 10 pounds more is about another ${Math.round(per10)}%.`,
    lever: "Protect your power while the weight comes off: fuel your key rides and keep one or two harder sessions a week.",
    numbers,
  };
}

export function muscleInsight(data: Data): Insight | null {
  const month = factsOf(data).body_composition?.last_30_days;
  if (!month) return null;
  const loss = -(month.fat_change_lb + month.lean_change_lb);
  const numbers = [
    { label: "Fat, last 30 days", value: `${month.fat_change_lb > 0 ? "+" : ""}${fmt1(month.fat_change_lb)} lb` },
    { label: "Everything else", value: `${month.lean_change_lb > 0 ? "+" : ""}${fmt1(month.lean_change_lb)} lb` },
  ];
  if (loss < MIN_LOSS_TO_JUDGE_LB) {
    return {
      id: "muscle",
      topic: "Muscle",
      tone: "good",
      headline: "Too little change to judge yet",
      effect: "Scale body composition is noisy, so it takes a few pounds of change before it says anything about muscle.",
      lever: "Keep protein steady at every meal.",
      numbers,
    };
  }
  const fatShare = -month.fat_change_lb / loss;
  numbers.push({ label: "Share that was fat", value: `${Math.round(Math.max(0, Math.min(1, fatShare)) * 100)}%` });
  if (fatShare >= 0.75) {
    return {
      id: "muscle",
      topic: "Muscle",
      tone: "good",
      headline: "Muscle is holding up",
      effect: "Over the last month the loss has come mostly from fat, so the muscle that makes your watts is staying put.",
      lever: "Keep protein steady and keep one or two hard efforts a week.",
      numbers,
    };
  }
  if (fatShare >= 0.5) {
    return {
      id: "muscle",
      topic: "Muscle",
      tone: "watch",
      headline: "Some muscle is going with the fat",
      effect: "Scale readings are noisy, but over a month part of the loss looks like muscle, and muscle is what produces your watts.",
      lever: "Slow the pace a little and get protein in within an hour after rides.",
      numbers,
    };
  }
  return {
    id: "muscle",
    topic: "Muscle",
    tone: "act",
    headline: "You're losing muscle along with fat",
    effect: "Over the last month more than half the loss looks like muscle, which will cost you power on the bike and slow your recovery.",
    lever: "Slow the loss to about a pound a week, add protein at every meal and keep one strength session a week.",
    numbers,
  };
}

/** Every Weight insight that has data, in reading order. */
export function buildWeightInsights(data: Data): Insight[] {
  return [paceInsight(data), powerToWeightInsight(data), muscleInsight(data)].filter((i): i is Insight => i !== null);
}
