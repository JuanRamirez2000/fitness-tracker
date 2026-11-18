import type { Activity } from "@/lib/data/activities";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { runsIn, runsOf, totalMiles } from "./runs";

/**
 * Is running mileage climbing faster than the legs can follow? The last 7 days of running
 * against the weekly average of the 4 weeks before them. Running only: bike and swim time
 * doesn't load the same tendons and bones. Pure, unit-tested (ramp.test.ts).
 */

/** A week up more than this on the 4-week average is a jump worth flagging (the usual
 * advice is about 10%; a little slack keeps one long run from tripping it). */
export const RAMP_LIMIT = 0.15;
/** ...and by at least this many miles, so 2 → 2.5 miles isn't a "25% jump". */
const MIN_EXTRA_MILES = 1.5;
/** Below this weekly average there's no base to measure against yet. */
const BASE_MILES = 2;
/** Coming back from almost nothing, a week past this is already a big step. */
const FROM_NOTHING_MILES = 8;

export interface RunRamp {
  /** Miles run in the 7 days through the day asked about. */
  lastWeekMiles: number;
  /** The weekly average over the 28 days before that. */
  baseWeeklyMiles: number;
  /** lastWeek against base, as a fraction (0.2 = up 20%); null without a base. */
  change: number | null;
  warn: boolean;
  /** One plain sentence: what happened, and what to do when it's a warning. */
  text: string;
}

const mi = (n: number) => n.toFixed(1);

export function runRamp(activities: readonly Activity[], asOf: LocalDate): RunRamp | null {
  const runs = runsOf([...activities]);
  const lastWeekMiles = totalMiles(runsIn(runs, { from: addDays(asOf, -6), to: asOf }));
  const baseWeeklyMiles = totalMiles(runsIn(runs, { from: addDays(asOf, -34), to: addDays(asOf, -7) })) / 4;
  if (lastWeekMiles === 0 && baseWeeklyMiles === 0) return null;

  if (baseWeeklyMiles < BASE_MILES) {
    const warn = lastWeekMiles >= FROM_NOTHING_MILES;
    return {
      lastWeekMiles, baseWeeklyMiles, change: null, warn,
      text: warn
        ? `${mi(lastWeekMiles)} miles of running in the last 7 days after almost none the month before: a big step. Keep the runs easy and add nothing extra this week.`
        : `${mi(lastWeekMiles)} miles of running in the last 7 days, building from a quiet month.`,
    };
  }
  const change = (lastWeekMiles - baseWeeklyMiles) / baseWeeklyMiles;
  const warn = change > RAMP_LIMIT && lastWeekMiles - baseWeeklyMiles >= MIN_EXTRA_MILES;
  return {
    lastWeekMiles, baseWeeklyMiles, change, warn,
    text: warn
      ? `${mi(lastWeekMiles)} miles of running in the last 7 days, up ${Math.round(change * 100)}% on your ${mi(baseWeeklyMiles)}-mile weekly average. Hold next week near this, keep easy runs easy, and skip extra runs.`
      : change < -RAMP_LIMIT
        ? `${mi(lastWeekMiles)} miles of running in the last 7 days, under your ${mi(baseWeeklyMiles)}-mile weekly average: room to build back up gradually.`
        : `${mi(lastWeekMiles)} miles of running in the last 7 days against a ${mi(baseWeeklyMiles)}-mile weekly average: a safe build.`,
  };
}
