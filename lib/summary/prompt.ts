import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";
import type { DailyTraining } from "@/lib/data/training";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { FACTOR_LABELS } from "@/lib/today/hero";
import { trainingStatus } from "@/lib/charts/training";

/** The rows a morning summary is written from (lib/summary/generate.ts loads them). */
export interface SummaryInput {
  today: LocalDate;
  /** Recent days, oldest first; the last few are enough. */
  recovery: DailyRecovery[];
  sleep: SleepNight[];
  training: DailyTraining[];
  weightTrend: WeightTrendRow[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const latest = <T extends { local_date: LocalDate }>(rows: T[], today: LocalDate, has: (r: T) => boolean) =>
  [...rows].reverse().find((r) => r.local_date <= today && has(r)) ?? null;

/**
 * Today's facts as a small plain object: only Garmin's values and simple differences, each
 * labelled with its unit, and only what exists (a missing part is left out, so the model can't
 * be tempted to fill it in). Pure, unit-tested.
 */
export function summaryFacts(input: SummaryInput): Record<string, unknown> {
  const { today } = input;
  const facts: Record<string, unknown> = { date: today };

  const r = input.recovery.find((row) => row.local_date === today) ?? null;
  if (r?.readiness_score != null) {
    facts.training_readiness = {
      score_0_100: r.readiness_score,
      level: r.readiness_level,
      ...(r.readiness_morning_score != null && r.readiness_morning_score !== r.readiness_score
        ? { score_at_wake: r.readiness_morning_score }
        : {}),
      factors_percent: Object.fromEntries(
        Object.entries(r.readiness_factors ?? {}).flatMap(([k, v]) =>
          v == null ? [] : [[FACTOR_LABELS[k as keyof typeof FACTOR_LABELS] ?? k, v]],
        ),
      ),
      ...(r.recovery_hours != null ? { recovery_time_left_hours: r.recovery_hours } : {}),
    };
  }

  const night = input.sleep.find((n) => n.local_date === today && (n.duration_s ?? 0) > 0);
  if (night) {
    facts.last_night_sleep = {
      hours: round1((night.duration_s ?? 0) / 3600),
      ...(night.need_s != null ? { need_hours: round1(night.need_s / 3600) } : {}),
      ...(night.score != null ? { score_0_100: night.score } : {}),
      deep_hours: round1((night.deep_s ?? 0) / 3600),
      rem_hours: round1((night.rem_s ?? 0) / 3600),
    };
  }

  if (r?.hrv_ms != null) {
    facts.overnight_hrv = {
      ms: r.hrv_ms,
      ...(r.hrv_baseline_low != null && r.hrv_baseline_high != null
        ? { normal_range_ms: [r.hrv_baseline_low, r.hrv_baseline_high] }
        : {}),
      ...(r.hrv_status ? { status: r.hrv_status } : {}),
    };
  }
  if (r?.resting_hr != null) facts.resting_hr_bpm = r.resting_hr;
  if (r?.body_battery_wake != null) facts.body_battery_at_wake_0_100 = r.body_battery_wake;

  const t = latest(input.training, today, (row) => row.acute_load !== null);
  if (t && t.local_date >= addDays(today, -1)) {
    facts.training_load = {
      acute: t.acute_load,
      chronic: t.chronic_load,
      ...(t.acwr != null ? { acute_chronic_ratio: t.acwr } : {}),
      ...(t.status ? { status: trainingStatus(t.status)?.label } : {}),
    };
  }

  const w = latest(input.weightTrend, today, () => true);
  if (w && w.local_date >= addDays(today, -3)) {
    const weekAgo = latest(input.weightTrend, addDays(w.local_date, -7), () => true);
    facts.weight_lb = {
      seven_day_average: round1(w.avg7_lb),
      ...(weekAgo && weekAgo.local_date >= addDays(w.local_date, -10)
        ? { change_vs_a_week_ago: round1(w.avg7_lb - weekAgo.avg7_lb) }
        : {}),
    };
  }

  return facts;
}

export const SUMMARY_SYSTEM = `You write the morning summary at the top of one person's fitness dashboard (the Daily feel tab). They read it once, on waking, to know how recovered they are and how hard to go today, not to re-read the numbers.

Write exactly 4 sentences of plain prose, speaking to them as "you": no greeting, headings, lists or emoji.
1. How recovered they are this morning overall, with one or two rounded numbers at most (readiness, Body Battery at wake).
2. The one thing helping or holding them back most, against their own normal or need: sleep against what they needed, HRV against its usual range, resting heart rate.
3. What that means for training today, connected to where their training load is heading.
4. One concrete plan: today's effort (rest, easy, moderate or hard) and one thing to do for tomorrow (sleep, an easy day, fuel).

Describe HRV and resting heart rate by how they compare with normal ("calm and balanced", "below its usual range"), never in milliseconds or exact bpm. Round as a person would ("about 6 hours"). Use only what's in the data; leave out anything that isn't there rather than guessing. This is a training log, not medical advice: don't diagnose or suggest treatment.

Example of the style (different day, different numbers; write your own from today's data):
You're well recovered this morning, with Body Battery at 81 and your nervous system calm and balanced. The weak spot is sleep: about 6 hours against the 7 you need. Your training load is building at a productive rate, so you can handle work today, but a short night lowers the ceiling on intensity. Keep today moderate and protect tonight's sleep so tomorrow can be the harder day.`;

/** The user turn: the facts as JSON (every tab's). */
export function summaryUserMessage(facts: Record<string, unknown>): string {
  return `Today's data:\n${JSON.stringify(facts, null, 2)}`;
}

/** Whether there is enough to write about: readiness or last night's sleep, at least. */
export function hasEnoughForSummary(facts: Record<string, unknown>): boolean {
  return "training_readiness" in facts || "last_night_sleep" in facts;
}
