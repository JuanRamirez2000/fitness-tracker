import "server-only";
import { db } from "@/lib/db";
import type { DayWindow } from "@/lib/dates/calendar";
import { profileSchema, type Profile, type ProfileSettings } from "./profiles";
import { weighInRowSchema, type WeighIn, type WeighInInput } from "./weigh-ins";
import { weightTrendRowSchema, type WeightTrendRow } from "./weight-trend";

// Every database query lives here, apart from the pure schemas next to them, so a client
// component can import a schema without pulling the Postgres driver into the browser bundle.
// "server-only" turns any such accidental import into a build error instead.

/** The app has exactly one athlete: the first (and only) profile row. */
export async function fetchOwnerProfile(): Promise<Profile | null> {
  const [row] = await db()`
    select id, display_name, timezone, program_start_date,
           goal_weight_lb, goal_pace_lb_per_week, start_weight_lb
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
