/**
 * Home's readiness card in plain words: Garmin's readiness factors as "helping" and "holding you
 * back" phrases, and its recovery hours as a "ready for hard effort by" time. Pure, unit-tested.
 */
import type { DailyRecovery, ReadinessFactorKey } from "@/lib/data/recovery";
import { clockTimeIn, localDateIn } from "@/lib/dates/timezone";
import { factorState, type HeroFactor } from "@/lib/today/hero";

/** When the recovery clock runs out: "Now", or "6 pm" today, or "Thu 6 pm". */
export function readyBy(r: Pick<DailyRecovery, "recovery_hours" | "readiness_at">, timeZone: string, now: Date = new Date()): { ready: boolean; label: string } | null {
  if (r.recovery_hours === null || r.readiness_at === null) return null;
  const at = new Date(new Date(r.readiness_at).getTime() + r.recovery_hours * 3600_000);
  if (at.getTime() <= now.getTime() || r.recovery_hours <= 0) return { ready: true, label: "Now" };
  const sameDay = localDateIn(at, timeZone) === localDateIn(now, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(at);
  return { ready: false, label: `${sameDay ? "" : `${weekday} `}${clockTimeIn(at, timeZone)}` };
}

/** Each readiness factor in plain words, when it's helping and when it's holding you back. */
const FACTOR_PHRASES: Record<ReadinessFactorKey, { good: string; bad: string }> = {
  sleep: { good: "A good night's sleep", bad: "A short or restless night" },
  sleep_history: { good: "Good sleep over the last few nights", bad: "Short sleep over the last few nights" },
  hrv: { good: "HRV in its normal range", bad: "HRV below its usual range" },
  recovery_time: { good: "Recovered from recent workouts", bad: "Still recovering from recent workouts" },
  acwr: { good: "Training load building at a healthy rate", bad: "Load rising faster than your body is used to" },
  stress_history: { good: "Low stress lately", bad: "High stress over the last few days" },
};

export interface FactorPhrase {
  key: ReadinessFactorKey;
  text: string;
  percent: number;
  /** Fair (60-84%) holds you back a little; low (under 60%) a lot. */
  strength: "good" | "fair" | "low";
}

/** The readiness factors split into what's helping (Good) and what's holding you back (Fair or
 * Low, weakest first). */
export function splitFactors(factors: HeroFactor[]): { helping: FactorPhrase[]; holding: FactorPhrase[] } {
  const phrases = factors.map((f) => {
    const state = factorState(f.percent);
    return { key: f.key, percent: f.percent, strength: state, text: FACTOR_PHRASES[f.key][state === "good" ? "good" : "bad"] };
  });
  return {
    helping: phrases.filter((p) => p.strength === "good").sort((a, b) => b.percent - a.percent),
    holding: phrases.filter((p) => p.strength !== "good").sort((a, b) => a.percent - b.percent),
  };
}
