/**
 * An insight card: one thing about how you're doing, said as its state, what that means for you,
 * and one thing to do, with the raw numbers kept out of the way (behind "The numbers"). The
 * Daily feel and Weight tabs build these from pure rule functions (daily.ts, weight.ts).
 */
export type InsightTone = "good" | "watch" | "act";

export interface Insight {
  id: string;
  /** The small label: "Sleep", "Pace of loss". */
  topic: string;
  tone: InsightTone;
  /** The state, in words: "Sleep is your weak spot". */
  headline: string;
  /** What it means for training or how you'll feel. */
  effect: string;
  /** One thing to do. */
  lever: string;
  /** The numbers behind it, shown only on request. */
  numbers: { label: string; value: string }[];
}

/** Rounds to the nearest quarter hour, in minutes (at least 15). */
export function quarterHours(minutes: number): number {
  return Math.max(15, Math.round(minutes / 15) * 15);
}

export const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
