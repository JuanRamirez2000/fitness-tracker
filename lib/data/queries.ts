import "server-only";
import { db } from "@/lib/db";
import type { DayWindow } from "@/lib/dates/calendar";
import { activityRowSchema, type Activity } from "./activities";
import { activityDetailRowSchema, activityEffortsSchema, type ActivityDetail, type RunEfforts } from "./activity-details";
import { injectionRowSchema, type Injection } from "./injections";
import { profileSchema, type Profile, type ProfileSettings } from "./profiles";
import {
  dailyRecoveryRowSchema,
  dailySummaryRowSchema,
  sleepNightRowSchema,
  type DailyRecovery,
  type DailySummary,
  type SleepNight,
} from "./recovery";
import { dailyTrainingRowSchema, type DailyTraining } from "./training";
import { dailyStepsRowSchema, type DailySteps } from "./steps";
import { bodyCompositionDaySchema, weighInRowSchema, type BodyCompositionDay, type WeighIn, type WeighInInput } from "./weigh-ins";
import { weightTrendRowSchema, type WeightTrendRow } from "./weight-trend";

// Every database query lives here, apart from the pure schemas next to them, so a client
// component can import a schema without pulling the Postgres driver into the browser bundle.
// "server-only" turns any such accidental import into a build error instead.

/** The app has exactly one athlete: the first (and only) profile row. */
export async function fetchOwnerProfile(): Promise<Profile | null> {
  const [row] = await db()`
    select id, display_name, timezone, program_start_date,
           goal_weight_lb, goal_pace_lb_per_week, start_weight_lb, shot_weekday, hr_zone_bounds
    from profiles order by created_at limit 1`;
  return row ? profileSchema.parse(row) : null;
}

export async function updateProfile(id: string, values: ProfileSettings): Promise<void> {
  await db()`update profiles set ${db()(values)} where id = ${id}`;
}

/**
 * Every weigh-in in `range`, including several on one day (the table edits raw rows),
 * newest first. For the one that counts per day, see weight_trend.
 */
export async function fetchWeighIns(userId: string, range: DayWindow): Promise<WeighIn[]> {
  const rows = await db()`
    select * from weigh_ins
    where user_id = ${userId} and local_date between ${range.from} and ${range.to}
    order by local_date desc, measured_at desc`;
  return rows.map((row) => weighInRowSchema.parse(row));
}

/** `measuredAt` comes from defaultMeasuredAt() (lib/dates/timezone.ts) — the caller owns
 * timezone handling, this module stays timezone-agnostic. */
export async function insertWeighIn(userId: string, values: WeighInInput, measuredAt: Date): Promise<void> {
  await db()`
    insert into weigh_ins (user_id, local_date, weight_lb, measured_at, source)
    values (${userId}, ${values.local_date}, ${values.weight_lb}, ${measuredAt.toISOString()}, 'manual')`;
}

export async function updateWeighIn(userId: string, id: string, values: WeighInInput): Promise<void> {
  await db()`
    update weigh_ins set local_date = ${values.local_date}, weight_lb = ${values.weight_lb}
    where id = ${id} and user_id = ${userId}`;
}

export async function deleteWeighIn(userId: string, id: string): Promise<void> {
  await db()`delete from weigh_ins where id = ${id} and user_id = ${userId}`;
}

/** The user's whole history, oldest first. The view's window functions see every row, so
 * deltas and averages are correct at any date a caller later slices at. */
export async function fetchWeightTrend(userId: string): Promise<WeightTrendRow[]> {
  const rows = await db()`select * from weight_trend where user_id = ${userId} order by local_date`;
  return rows.map((row) => weightTrendRowSchema.parse(row));
}

/** Every shot, oldest first. About one a week, so never windowed: matching a shot to the
 * schedule needs to see shots just outside any window too. */
export async function fetchInjections(userId: string): Promise<Injection[]> {
  const rows = await db()`select * from injections where user_id = ${userId} order by local_date`;
  return rows.map((row) => injectionRowSchema.parse(row));
}

/** Marks `localDate` as a shot day, or clears it. At most one shot per day. */
export async function setShot(userId: string, localDate: string, taken: boolean): Promise<void> {
  if (taken) {
    await db()`insert into injections (user_id, local_date) values (${userId}, ${localDate})
               on conflict (user_id, local_date) do nothing`;
  } else {
    await db()`delete from injections where user_id = ${userId} and local_date = ${localDate}`;
  }
}

/** Each day's step count inside `range`, oldest first. Days with no row had no data. */
export async function fetchSteps(userId: string, range: DayWindow): Promise<DailySteps[]> {
  const rows = await db()`
    select * from daily_steps
    where user_id = ${userId} and local_date between ${range.from} and ${range.to}
    order by local_date`;
  return rows.map((row) => dailyStepsRowSchema.parse(row));
}

/** Every activity, oldest first. Never windowed: a few hundred rows a year, and the running
 * KPIs compare the latest weeks against the ones before any selected range. */
export async function fetchActivities(userId: string): Promise<Activity[]> {
  const rows = await db()`select * from activities where user_id = ${userId} order by started_at`;
  return rows.map((row) => activityRowSchema.parse(row));
}

/** Every run's best efforts (migration 012), oldest first: only runs whose detail has them. */
export async function fetchRunEfforts(userId: string): Promise<RunEfforts[]> {
  const rows = await db()`
    select a.id as activity_id, a.local_date, a.name, d.efforts
    from activities a join activity_details d on d.activity_id = a.id
    where a.user_id = ${userId} and a.activity_type like '%running' and d.efforts is not null
    order by a.started_at`;
  return rows.map((r) => ({
    activity_id: String(r.activity_id),
    local_date: String(r.local_date),
    name: r.name === null ? null : String(r.name),
    efforts: activityEffortsSchema.parse(r.efforts),
  }));
}

/** One activity by its row id, or null (also for a malformed id). */
export async function fetchActivity(userId: string, id: string): Promise<Activity | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db()`select * from activities where user_id = ${userId} and id = ${id}`;
  return row ? activityRowSchema.parse(row) : null;
}

/** An activity's samples and splits (migration 010), or null if never fetched. */
export async function fetchActivityDetail(userId: string, activityId: string): Promise<ActivityDetail | null> {
  const [row] = await db()`select * from activity_details where user_id = ${userId} and activity_id = ${activityId}`;
  return row ? activityDetailRowSchema.parse(row) : null;
}

export interface ActivitySummary {
  text: string;
  model: string;
  generated_at: string;
}

/** An activity's AI summary (migration 011), or null if none was written. */
export async function fetchActivitySummary(userId: string, activityId: string): Promise<ActivitySummary | null> {
  const [row] = await db()`
    select text, model, generated_at from activity_summaries where user_id = ${userId} and activity_id = ${activityId}`;
  return row ? { text: String(row.text), model: String(row.model), generated_at: String(row.generated_at) } : null;
}

export async function saveActivitySummary(userId: string, activityId: string, text: string, model: string): Promise<ActivitySummary> {
  const [row] = await db()`
    insert into activity_summaries (activity_id, user_id, text, model, generated_at)
    values (${activityId}, ${userId}, ${text}, ${model}, now())
    on conflict (activity_id) do update set text = excluded.text, model = excluded.model, generated_at = excluded.generated_at
    returning text, model, generated_at`;
  return { text: String(row.text), model: String(row.model), generated_at: String(row.generated_at) };
}

/** Activities starting in `range` that have no AI summary yet, oldest first. */
export async function fetchActivityIdsWithoutSummary(userId: string, range: DayWindow): Promise<string[]> {
  const rows = await db()`
    select a.id from activities a
    left join activity_summaries s on s.activity_id = a.id
    where a.user_id = ${userId} and a.local_date between ${range.from} and ${range.to} and s.activity_id is null
    order by a.started_at`;
  return rows.map((r) => String(r.id));
}

/** Each day's recovery row inside `range`, oldest first. */
export async function fetchRecovery(userId: string, range: DayWindow): Promise<DailyRecovery[]> {
  const rows = await db()`
    select user_id, local_date, resting_hr, hrv_ms, hrv_baseline_low, hrv_baseline_high, hrv_status,
           body_battery_high, body_battery_low, body_battery_wake, avg_stress,
           readiness_score, readiness_level, readiness_factors, readiness_at,
           readiness_morning_score, recovery_hours
    from daily_recovery
    where user_id = ${userId} and local_date between ${range.from} and ${range.to}
    order by local_date`;
  return rows.map((row) => dailyRecoveryRowSchema.parse(row));
}

/** Each night inside `range` (by wake-up day), oldest first. */
export async function fetchSleepNights(userId: string, range: DayWindow): Promise<SleepNight[]> {
  const rows = await db()`
    select user_id, local_date, bedtime, wake_time, duration_s, deep_s, rem_s, light_s, awake_s, score, need_s
    from sleep_nights
    where user_id = ${userId} and local_date between ${range.from} and ${range.to}
    order by local_date`;
  return rows.map((row) => sleepNightRowSchema.parse(row));
}

/**
 * Each day's body composition (the earliest weigh-in of the day that has one), oldest first.
 * Never windowed: the "since the first scale reading" stats need the very first one, and it
 * is one row a day.
 */
export async function fetchBodyComposition(userId: string): Promise<BodyCompositionDay[]> {
  const rows = await db()`
    select distinct on (local_date)
      local_date, weight_lb, body_fat_pct, muscle_mass_lb, bone_mass_lb, body_water_pct
    from weigh_ins
    where user_id = ${userId} and body_fat_pct is not null
    order by local_date, measured_at`;
  return rows.map((row) => bodyCompositionDaySchema.parse(row));
}

/** Every day's training snapshot up to `to`, oldest first. Unbounded at the start: VO2 max
 * compares against months back and charts its history; one small row a day. */
export async function fetchTraining(userId: string, to: string): Promise<DailyTraining[]> {
  const rows = await db()`
    select local_date, acute_load, chronic_load, chronic_low, chronic_high, acwr, status, focus, focus_feedback,
           vo2max, race_5k_s, race_10k_s, race_half_s, fitness_age, fitness_age_achievable, chronological_age,
           fitness_age_factors
    from daily_training
    where user_id = ${userId} and local_date <= ${to}
    order by local_date`;
  return rows.map((row) => dailyTrainingRowSchema.parse(row));
}

/** The AI summary written for `tab` on `date`, if any. */
export async function fetchDailySummary(userId: string, date: string, tab: string): Promise<DailySummary | null> {
  const [row] = await db()`
    select local_date, tab, text, model, generated_at from daily_summaries
    where user_id = ${userId} and local_date = ${date} and tab = ${tab}`;
  return row ? dailySummaryRowSchema.parse(row) : null;
}
