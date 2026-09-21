import type { ActivityInput } from "@/lib/data/activities";
import { STEPS_METRIC, type StepsInput } from "@/lib/data/daily-metrics";
import type { InjectionInput } from "@/lib/data/injections";
import type { NutritionDayInput } from "@/lib/data/nutrition-days";
import type { WeighInInput } from "@/lib/data/weigh-ins";
import { addDays, eachDay, weekdayOf, type LocalDate } from "@/lib/dates/calendar";
import { instantAt } from "@/lib/dates/timezone";

export interface DemoOptions {
  userId: string;
  timeZone: string;
  today: LocalDate;
  programStart: LocalDate;
  shotWeekday: number;
  startWeightLb: number;
  /** Keys present in activity_types, so a renamed type cannot break the insert. */
  activityTypes: readonly string[];
  seed: number;
}

export interface DemoData {
  weighIns: (WeighInInput & { user_id: string; measured_at: string; source: "manual" })[];
  nutritionDays: (NutritionDayInput & { user_id: string })[];
  activities: (ActivityInput & { user_id: string; source: "manual" })[];
  injections: (InjectionInput & { user_id: string })[];
  dailyMetrics: (StepsInput & {
    user_id: string;
    metric: typeof STEPS_METRIC;
    source: "manual";
  })[];
}

// Roughly -0.8 lb/week overall with a weekday rhythm, plus daily noise.
const WEEKDAY_DRIFT_LB = [-0.34, -0.3, -0.14, -0.05, 0.03, 0.06, -0.08];
const NOISE_LB = 0.55;

const MISSED_WEIGH_IN_RATE = 0.11;
const SECOND_WEIGH_IN_RATE = 0.03;
const MISSED_STEPS_RATE = 0.12;

const ACTIVITY_MIX: readonly (readonly [string, number])[] = [
  ["walk", 3],
  ["lift", 3],
  ["run", 2],
  ["ride", 1],
  ["swim", 1],
  ["other", 1],
];

const LIFT_NOTES = [
  "Squat 3×5 @ 185 · bench 3×8",
  "Deadlift 1×5 @ 225 · rows 3×10",
  "Overhead press 3×8 · pull-ups 3×6",
];

// Shots to make imperfect on purpose, by index into the weekly schedule, so every star
// state shows up: late by n days, skipped, and an extra entry two days after a shot.
const LATE_SHOTS: Readonly<Record<number, number>> = { 6: 1, 14: 2 };
const SKIPPED_SHOT = 21;
const EXTRA_ENTRY_AFTER_SHOT = 3;

/** mulberry32: small, seedable, and stable across platforms. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function generateDemoData(o: DemoOptions): DemoData {
  const rand = random(o.seed);
  const mix = ACTIVITY_MIX.filter(([key]) => o.activityTypes.includes(key));
  if (mix.length === 0) throw new Error("activity_types has none of the demo types; run schema.sql");

  const pickActivity = (exclude?: string): string => {
    const options = mix.filter(([key]) => key !== exclude);
    let roll = rand() * options.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [key, weight] of options) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return options[options.length - 1][0];
  };

  const data: DemoData = {
    weighIns: [],
    nutritionDays: [],
    activities: [],
    injections: [],
    dailyMetrics: [],
  };
  const user_id = o.userId;
  const days = eachDay(o.programStart, o.today);

  let weight = o.startWeightLb;
  days.forEach((local_date, i) => {
    if (i > 0) weight += WEEKDAY_DRIFT_LB[i % 7] + (rand() - 0.5) * NOISE_LB;

    // The first day is always weighed so the start weight is exactly startWeightLb.
    if (i === 0 || rand() > MISSED_WEIGH_IN_RATE) {
      const minute = Math.floor(rand() * 60);
      data.weighIns.push({
        user_id,
        local_date,
        weight_lb: i === 0 ? o.startWeightLb : round1(weight),
        measured_at: instantAt(local_date, 7, minute, o.timeZone).toISOString(),
        source: "manual",
      });
      // A later second weigh-in the same day; the earliest one is the one that counts.
      if (rand() < SECOND_WEIGH_IN_RATE) {
        data.weighIns.push({
          user_id,
          local_date,
          weight_lb: round1(weight + (rand() - 0.5) * 0.8),
          measured_at: instantAt(local_date, 18, minute, o.timeZone).toISOString(),
          source: "manual",
        });
      }
    }

    const nutrition = rand();
    if (nutrition >= 0.08) {
      const tracking_status =
        nutrition < 0.2 ? "missed" : nutrition < 0.42 ? "uncertain" : "accurate";
      data.nutritionDays.push({
        user_id,
        local_date,
        tracking_status,
        calories_kcal: null,
        notes: tracking_status === "uncertain" && rand() < 0.5 ? "Dinner out, estimated" : null,
      });
    }

    if (rand() > MISSED_STEPS_RATE) {
      data.dailyMetrics.push({
        user_id,
        local_date,
        metric: STEPS_METRIC,
        value: Math.round(3200 + rand() * 11500),
        source: "manual",
      });
    }

    const activityRoll = rand();
    if (activityRoll > 0.6) {
      const first = pickActivity();
      const twoActivities = activityRoll > 0.92 && mix.length > 1;
      const types = twoActivities ? [first, pickActivity(first)] : [first];
      for (const activity_type of types) {
        data.activities.push({
          user_id,
          local_date,
          activity_type,
          duration_min: rand() < 0.6 ? 20 + Math.floor(rand() * 56) : null,
          notes: activity_type === "lift" ? LIFT_NOTES[Math.floor(rand() * LIFT_NOTES.length)] : null,
          source: "manual",
        });
      }
    }
  });

  days
    .filter((day) => weekdayOf(day) === o.shotWeekday)
    .forEach((scheduled, index) => {
      if (index === SKIPPED_SHOT) return;
      const actual = addDays(scheduled, LATE_SHOTS[index] ?? 0);
      const late = actual !== scheduled;
      if (actual <= o.today) {
        data.injections.push({
          user_id,
          local_date: actual,
          dose_mg: null,
          notes: late ? "Traveling" : null,
        });
      }
      const extra = addDays(scheduled, 2);
      if (index === EXTRA_ENTRY_AFTER_SHOT && extra <= o.today) {
        data.injections.push({ user_id, local_date: extra, dose_mg: null, notes: null });
      }
    });

  return data;
}
