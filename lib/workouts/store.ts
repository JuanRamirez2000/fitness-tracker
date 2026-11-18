import { plannedWorkoutRowSchema, type PlannedWorkout, type PushStatus } from "@/lib/data/planned";
import type { DayWindow } from "@/lib/dates/calendar";
import { db } from "@/lib/db";

/**
 * Database reads and writes for the workout builder: planned sessions, the tracker's own
 * workouts and their push status, the FTP inputs and the builder's settings. Not "server-only"
 * (unlike lib/data/queries.ts), so `npm run workout` can use it from the command line; the web
 * app reaches it only through server actions and server components.
 */

/** Plan sessions and own workouts between two days, soonest first (without the Garmin JSON). */
export async function fetchPlannedWorkouts(userId: string, range: DayWindow): Promise<PlannedWorkout[]> {
  const rows = await db()`
    select workout_uuid, local_date, sport, name, description, duration_s, benefit, rest_day, key_workout,
           status, plan_name, source, settings, steps, push_status, push_error, pushed_at, provider, duration_estimated
    from planned_workouts
    where user_id = ${userId} and local_date between ${range.from} and ${range.to}
    order by local_date, source, workout_uuid`;
  return rows.map((row) => plannedWorkoutRowSchema.parse(row));
}

/** What the FTP estimate needs: the best 20-minute power of any ride since `since`, and the
 * latest FTP set in Garmin. */
export async function fetchFtpInputs(userId: string, since: string): Promise<{ best20MinW: number | null; garminFtpW: number | null }> {
  const [row] = await db()`
    select
      (select max(max_20min_power_w) from activities
        where user_id = ${userId} and local_date >= ${since} and max_20min_power_w is not null
          and (activity_type like '%cycling' or activity_type like '%biking' or activity_type like '%ride')) as best20,
      (select ftp_w from daily_training where user_id = ${userId} and ftp_w is not null order by local_date desc limit 1) as ftp`;
  return { best20MinW: row?.best20 ?? null, garminFtpW: row?.ftp ?? null };
}

/** Activities since `since` (day, type, duration), for the planner's recent-volume numbers. */
export async function fetchRecentActivities(userId: string, since: string): Promise<{ local_date: string; activity_type: string; duration_s: number }[]> {
  const rows = await db()`
    select local_date, activity_type, duration_s from activities
    where user_id = ${userId} and local_date >= ${since} order by started_at`;
  return rows.map((r) => ({ local_date: String(r.local_date), activity_type: String(r.activity_type), duration_s: Number(r.duration_s) }));
}

/**
 * Roughly where the athlete trains: the start of their latest activity with GPS, rounded to a
 * tenth of a degree (about 10 km), which is all a weather forecast needs and all that leaves the
 * server. Null without any GPS activity.
 */
export async function fetchTrainingArea(userId: string): Promise<{ lat: number; lon: number } | null> {
  const rows = await db()`
    select d.series->'lat' as lat, d.series->'lon' as lon
    from activity_details d join activities a on a.id = d.activity_id
    where d.user_id = ${userId} and jsonb_typeof(d.series->'lat') = 'array'
    order by a.started_at desc limit 5`;
  for (const row of rows) {
    const lats = (row.lat ?? []) as (number | null)[];
    const lons = (row.lon ?? []) as (number | null)[];
    const i = lats.findIndex((v, k) => v !== null && lons[k] !== null);
    if (i >= 0) return { lat: Math.round(lats[i]! * 10) / 10, lon: Math.round(lons[i]! * 10) / 10 };
  }
  return null;
}

export interface NewSelfWorkout {
  workout_uuid: string;
  local_date: string;
  sport: string;
  name: string;
  description: string;
  duration_s: number;
  settings: Record<string, unknown>;
  steps: unknown[];
  garmin_workout: Record<string, unknown>;
  push_status: PushStatus;
}

export async function insertSelfWorkout(userId: string, w: NewSelfWorkout): Promise<void> {
  const sql = db();
  await sql`
    insert into planned_workouts (user_id, workout_uuid, local_date, sport, name, description, duration_s, source,
                                  settings, steps, garmin_workout, push_status)
    values (${userId}, ${w.workout_uuid}, ${w.local_date}, ${w.sport}, ${w.name}, ${w.description}, ${w.duration_s}, 'self',
            ${sql.json(w.settings as never)}, ${sql.json(w.steps as never)}, ${sql.json(w.garmin_workout as never)}, ${w.push_status})`;
}

/** One of the tracker's own workouts: its status and the Garmin ids that say whether it reached
 * the calendar. */
export async function fetchSelfWorkout(
  userId: string,
  uuid: string,
): Promise<{ workout_uuid: string; push_status: PushStatus | null; garmin_workout_id: number | null } | null> {
  const [row] = await db()`
    select workout_uuid, push_status, garmin_workout_id from planned_workouts
    where user_id = ${userId} and workout_uuid = ${uuid} and source = 'self'`;
  return row ? { workout_uuid: row.workout_uuid, push_status: row.push_status, garmin_workout_id: row.garmin_workout_id } : null;
}

export async function setPushStatus(userId: string, uuid: string, status: PushStatus): Promise<void> {
  await db()`
    update planned_workouts set push_status = ${status}, push_error = null, updated_at = now()
    where user_id = ${userId} and workout_uuid = ${uuid} and source = 'self'`;
}

export async function deleteSelfWorkout(userId: string, uuid: string): Promise<void> {
  await db()`delete from planned_workouts where user_id = ${userId} and workout_uuid = ${uuid} and source = 'self'`;
}

/** Push status of some own workouts; a missing uuid was removed. */
export async function fetchPushStatuses(
  userId: string,
  uuids: string[],
): Promise<{ workout_uuid: string; push_status: PushStatus | null; push_error: string | null }[]> {
  if (uuids.length === 0) return [];
  const rows = await db()`
    select workout_uuid, push_status, push_error from planned_workouts
    where user_id = ${userId} and source = 'self' and workout_uuid in ${db()(uuids)}`;
  return rows.map((r) => ({ workout_uuid: r.workout_uuid, push_status: r.push_status, push_error: r.push_error }));
}

/** Merges a change into profiles.workout_settings. */
export async function updateWorkoutSettings(userId: string, patch: Record<string, unknown>): Promise<void> {
  const sql = db();
  await sql`
    update profiles set workout_settings = coalesce(workout_settings, '{}'::jsonb) || ${sql.json(patch as never)}
    where id = ${userId}`;
}
