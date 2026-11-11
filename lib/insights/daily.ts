/**
 * The Daily feel tab's insights: sleep, HRV, resting heart rate and recovery, each as its state,
 * what it means for training, and one thing to do. The readiness factors become plain "helping"
 * and "holding you back" phrases, and Garmin's recovery hours a "ready for hard effort by" time.
 * Thresholds are deliberately simple and written down here. Pure, unit-tested.
 */
import type { DashboardData } from "@/lib/dashboard/types";
import type { DailyRecovery, ReadinessFactorKey, SleepNight } from "@/lib/data/recovery";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { clockTimeIn, localDateIn } from "@/lib/dates/timezone";
import { median } from "@/lib/running/runs";
import { factorState, type HeroFactor } from "@/lib/today/hero";
import { fmt1, quarterHours, type Insight } from "./types";

type Data = Pick<DashboardData, "recovery" | "sleep" | "today"> & { profile: Pick<DashboardData["profile"], "timezone"> };

const NIGHTS = 7;
/** Hours short over a week: past this it's the weak spot; past the lower one, worth watching. */
const DEBT_ACT_HOURS = 3;
const DEBT_WATCH_HOURS = 1;
/** Resting HR this many beats over its 30-day normal is a flag; the lower bound a watch. */
const RHR_ACT_BPM = 5;
const RHR_WATCH_BPM = 3;
const RHR_BASELINE_DAYS = 30;
/** Recovery time past this many hours is more than one easy day. */
const LONG_RECOVERY_HOURS = 36;
/** A bedtime shift worth suggesting tops out here: past an hour, nobody does it. */
const MAX_BEDTIME_SHIFT_MIN = 60;
/** An insight is about today: data older than this many days says nothing about this morning. */
const STALE_DAYS = 2;

/** The latest row with data, as long as it's recent enough to describe today. */
const latest = <T extends { local_date: LocalDate }>(rows: T[], today: LocalDate, has: (r: T) => boolean) => {
  const row = [...rows].reverse().find((r) => r.local_date <= today && has(r)) ?? null;
  return row && row.local_date >= addDays(today, -STALE_DAYS) ? row : null;
};
const bedtimeShift = (minutes: number) => Math.min(MAX_BEDTIME_SHIFT_MIN, quarterHours(minutes));

export function sleepInsight(data: Data): Insight | null {
  const has = (n: SleepNight) => (n.duration_s ?? 0) > 0 && n.need_s !== null;
  const last = latest(data.sleep, data.today, has);
  if (!last) return null;
  const week = data.sleep.filter((n) => n.local_date <= last.local_date && n.local_date > addDays(last.local_date, -NIGHTS) && has(n));
  const debt = week.reduce((s, n) => s + (n.need_s! - n.duration_s!) / 3600, 0);
  const lastHours = last.duration_s! / 3600;
  const needHours = last.need_s! / 3600;
  const numbers = [
    { label: "Last night", value: `${fmt1(lastHours)} h${last.score !== null ? ` · score ${last.score}` : ""}` },
    { label: "Your need", value: `${fmt1(needHours)} h` },
    { label: `Last ${week.length} nights`, value: debt > 0 ? `${fmt1(debt)} h short` : `${fmt1(-debt)} h over` },
  ];
  if (debt >= DEBT_ACT_HOURS || lastHours < needHours - 1.5) {
    return {
      id: "sleep",
      topic: "Sleep",
      tone: "act",
      headline: "Sleep is your weak spot",
      effect: `You're about ${Math.round(Math.max(debt, needHours - lastHours))} hours short this week. A sleep debt makes hard efforts feel harder than the numbers say and slows recovery between sessions.`,
      lever: `Get to bed ${bedtimeShift((Math.max(debt, 0) / NIGHTS) * 60 + 15) === MAX_BEDTIME_SHIFT_MIN ? "an hour" : `about ${bedtimeShift((Math.max(debt, 0) / NIGHTS) * 60 + 15)} minutes`} earlier for the next few nights.`,
      numbers,
    };
  }
  if (debt >= DEBT_WATCH_HOURS || lastHours < needHours - 0.5) {
    return {
      id: "sleep",
      topic: "Sleep",
      tone: "watch",
      headline: "Sleep is running a little short",
      effect: "Not enough to hold you back yet, but short nights stack up and take the edge off harder sessions first.",
      lever: `Aim for a ${bedtimeShift(Math.max(15, (needHours - lastHours) * 60))}-minute earlier bedtime tonight.`,
      numbers,
    };
  }
  return {
    id: "sleep",
    topic: "Sleep",
    tone: "good",
    headline: "Sleep is on track",
    effect: "You're getting about what your body asks for, which is what lets each session's training actually stick.",
    lever: "Keep the same bedtime, weekends included.",
    numbers,
  };
}

export function hrvInsight(data: Data): Insight | null {
  const nights = data.recovery.filter((r) => r.local_date <= data.today && r.hrv_ms !== null);
  const last = latest(nights, data.today, () => true);
  if (!last || last.hrv_baseline_low === null || last.hrv_baseline_high === null) return null;
  const week = nights.filter((r) => r.local_date > addDays(last.local_date, -NIGHTS));
  const avg = week.reduce((s, r) => s + r.hrv_ms!, 0) / week.length;
  const numbers = [
    { label: "7-night average", value: `${Math.round(avg)} ms` },
    { label: "Last night", value: `${Math.round(last.hrv_ms!)} ms` },
    { label: "Your normal", value: `${last.hrv_baseline_low}–${last.hrv_baseline_high} ms` },
  ];
  if (avg < last.hrv_baseline_low) {
    return {
      id: "hrv",
      topic: "Nervous system (HRV)",
      tone: "act",
      headline: "Your body is under strain",
      effect: "Your HRV has slipped below its usual range: your nervous system hasn't caught up with recent training, stress or short sleep, so hard sessions now dig the hole deeper.",
      lever: "Keep today easy and give it two good nights before the next hard session.",
      numbers,
    };
  }
  if (avg > last.hrv_baseline_high) {
    return {
      id: "hrv",
      topic: "Nervous system (HRV)",
      tone: "good",
      headline: "Fully recharged",
      effect: "Your HRV is above its usual range, which usually follows easy days: there's plenty in the tank.",
      lever: "A good day for a key session if one is planned.",
      numbers,
    };
  }
  return {
    id: "hrv",
    topic: "Nervous system (HRV)",
    tone: "good",
    headline: "Your body is absorbing training well",
    effect: "Your HRV is steady inside its usual range, so recovery is keeping pace with what you're asking of it.",
    lever: "Stick with the plan; this is when hard sessions pay off.",
    numbers,
  };
}

export function restingHrInsight(data: Data): Insight | null {
  const days = data.recovery.filter((r) => r.local_date <= data.today && r.resting_hr !== null);
  const last = latest(days, data.today, () => true);
  if (!last) return null;
  const base = days.filter((r) => r.local_date < last.local_date && r.local_date >= addDays(last.local_date, -RHR_BASELINE_DAYS));
  if (base.length < 7) return null;
  const normal = median(base.map((r) => r.resting_hr!))!;
  const diff = last.resting_hr! - normal;
  const numbers = [
    { label: "This morning", value: `${last.resting_hr} bpm` },
    { label: "Your 30-day normal", value: `${Math.round(normal)} bpm` },
  ];
  if (diff >= RHR_ACT_BPM) {
    return {
      id: "rhr",
      topic: "Resting heart rate",
      tone: "act",
      headline: "Your heart is working harder at rest",
      effect: `It's about ${Math.round(diff)} beats above your normal, which usually means fatigue, heat, alcohol or a bug coming on.`,
      lever: "Make today easy and check it again tomorrow; if it's still up, take a rest day.",
      numbers,
    };
  }
  if (diff >= RHR_WATCH_BPM) {
    return {
      id: "rhr",
      topic: "Resting heart rate",
      tone: "watch",
      headline: "Resting heart rate is a little up",
      effect: "A few beats over normal is a mild sign of fatigue; one day of it means little on its own.",
      lever: "Go by feel today and back off if your heart rate climbs faster than usual.",
      numbers,
    };
  }
  return {
    id: "rhr",
    topic: "Resting heart rate",
    tone: "good",
    headline: diff <= -RHR_WATCH_BPM ? "Resting heart rate is lower than usual" : "Resting heart rate is normal",
    effect: diff <= -RHR_WATCH_BPM ? "A lower resting heart rate is one of the first signs of growing fitness." : "No sign of extra fatigue in your heart rate this morning.",
    lever: "Nothing to change.",
    numbers,
  };
}

/** When the recovery clock runs out: "Now", or "6 pm" today, or "Thu 6 pm". */
export function readyBy(r: Pick<DailyRecovery, "recovery_hours" | "readiness_at">, timeZone: string, now: Date = new Date()): { ready: boolean; label: string } | null {
  if (r.recovery_hours === null || r.readiness_at === null) return null;
  const at = new Date(new Date(r.readiness_at).getTime() + r.recovery_hours * 3600_000);
  if (at.getTime() <= now.getTime() || r.recovery_hours <= 0) return { ready: true, label: "Now" };
  const sameDay = localDateIn(at, timeZone) === localDateIn(now, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(at);
  return { ready: false, label: `${sameDay ? "" : `${weekday} `}${clockTimeIn(at, timeZone)}` };
}

export function recoveryInsight(data: Data, now: Date = new Date()): Insight | null {
  const r = latest(data.recovery, data.today, (row) => row.readiness_score !== null);
  if (!r) return null;
  const when = readyBy(r, data.profile.timezone, now);
  const numbers = [
    { label: "Readiness", value: `${r.readiness_score}${r.readiness_level ? ` · ${r.readiness_level.toLowerCase().replaceAll("_", " ")}` : ""}` },
    ...(r.recovery_hours !== null ? [{ label: "Recovery left", value: `${fmt1(Math.max(0, r.recovery_hours))} h` }] : []),
  ];
  if (!when || when.ready) {
    return {
      id: "recovery",
      topic: "Recovery",
      tone: "good",
      headline: "Ready for a hard session",
      effect: "Garmin's recovery clock has run out, so your legs have absorbed your last workout.",
      lever: "If a key session is planned, today's a good day for it.",
      numbers,
    };
  }
  return {
    id: "recovery",
    topic: "Recovery",
    tone: r.recovery_hours! > LONG_RECOVERY_HOURS ? "act" : "watch",
    headline: `Ready for hard effort by ${when.label}`,
    effect: "Your last sessions are still being absorbed; going hard before then adds fatigue faster than fitness.",
    lever: "Keep anything before then easy, in zones 1 and 2.",
    numbers,
  };
}

/** Every Daily feel insight that has data, in reading order. */
export function buildDailyInsights(data: Data, now: Date = new Date()): Insight[] {
  return [recoveryInsight(data, now), sleepInsight(data), hrvInsight(data), restingHrInsight(data)].filter((i): i is Insight => i !== null);
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
