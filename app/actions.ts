"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/session";
import { profileSettingsSchema } from "@/lib/data/profiles";
import { deleteWeighIn, fetchOwnerProfile, insertWeighIn, setShot, updateProfile, updateWeighIn } from "@/lib/data/queries";
import { weighInSchema } from "@/lib/data/weigh-ins";
import { localDateSchema } from "@/lib/dates/calendar";
import { defaultMeasuredAt, todayIn } from "@/lib/dates/timezone";
import { z } from "zod";
import { dispatchPush, type DispatchResult } from "@/lib/workouts/dispatch";
import { loadPlanner, saveWorkout, workoutRequestSchema } from "@/lib/workouts/service";
import { workoutSettingsPatchSchema } from "@/lib/workouts/settings";
import { deleteSelfWorkout, fetchSelfWorkout, setPushStatus, updateWorkoutSettings } from "@/lib/workouts/store";
import type { Effort } from "@/lib/workouts/types";

// Every write re-checks the session (server actions are public endpoints) and validates its
// input with the same zod schema the form uses, then refreshes the page's server data.

async function ownerProfile() {
  await requireOwner();
  const profile = await fetchOwnerProfile();
  if (!profile) throw new Error("No profile row exists yet. See README.");
  return profile;
}

export async function saveWeighIn(values: unknown, id?: string): Promise<void> {
  const profile = await ownerProfile();
  const parsed = weighInSchema.parse(values);
  if (id) await updateWeighIn(profile.id, id, parsed);
  else await insertWeighIn(profile.id, parsed, defaultMeasuredAt(parsed.local_date, profile.timezone));
  refresh();
}

export async function removeWeighIn(id: string): Promise<void> {
  const profile = await ownerProfile();
  await deleteWeighIn(profile.id, id);
  refresh();
}

export async function saveSettings(values: unknown): Promise<void> {
  const profile = await ownerProfile();
  await updateProfile(profile.id, profileSettingsSchema.parse(values));
  refresh();
}

export async function toggleShot(localDate: unknown, taken: boolean): Promise<void> {
  const profile = await ownerProfile();
  await setShot(profile.id, localDateSchema.parse(localDate), taken === true);
  refresh();
}

// ---------- The workout builder (lib/workouts/) ----------

export type WorkoutActionResult = { ok: true; uuid?: string; message: string } | { ok: false; message: string };

function queuedMessage(result: DispatchResult): string {
  return result.dispatched
    ? "Sending to Garmin. It usually lands on your watch's calendar within a couple of minutes."
    : "Queued. It goes out with the next Garmin import (twice a day) until the push trigger is set up.";
}

/** Builds a workout from the modal's settings (rebuilt here, never trusted from the browser),
 * saves it, and with `send` queues it for the Garmin calendar. */
export async function planWorkout(values: unknown, send: boolean): Promise<WorkoutActionResult> {
  const profile = await ownerProfile();
  const parsed = workoutRequestSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: "Those workout settings aren't valid." };
  const planner = await loadPlanner(profile, todayIn(profile.timezone));
  if (parsed.data.date < planner.today) return { ok: false, message: "Pick today or a later day." };
  const { uuid, workout } = await saveWorkout(profile.id, planner, { ...parsed.data, effort: parsed.data.effort as Effort }, send);
  const message = send ? queuedMessage(await dispatchPush()) : `Saved “${workout.name}” to your plan.`;
  refresh();
  return { ok: true, uuid, message };
}

/** Queues a saved draft (or a failed send) for the Garmin calendar. */
export async function sendWorkout(uuid: unknown): Promise<WorkoutActionResult> {
  const profile = await ownerProfile();
  const id = z.uuid().parse(uuid);
  const row = await fetchSelfWorkout(profile.id, id);
  if (!row) return { ok: false, message: "That workout no longer exists." };
  await setPushStatus(profile.id, id, "queued");
  const message = queuedMessage(await dispatchPush());
  refresh();
  return { ok: true, uuid: id, message };
}

/** Removes an own workout: straight away when it never reached Garmin, otherwise it's taken off
 * the Garmin calendar first (push_workout.py deletes the row once that's done). */
export async function removeWorkout(uuid: unknown): Promise<WorkoutActionResult> {
  const profile = await ownerProfile();
  const id = z.uuid().parse(uuid);
  const row = await fetchSelfWorkout(profile.id, id);
  if (!row) return { ok: true, message: "Already removed." };
  if (!row.garmin_workout_id) {
    await deleteSelfWorkout(profile.id, id);
    refresh();
    return { ok: true, message: "Removed." };
  }
  await setPushStatus(profile.id, id, "removing");
  const result = await dispatchPush();
  refresh();
  return {
    ok: true,
    uuid: id,
    message: result.dispatched ? "Taking it off your Garmin calendar." : "It comes off your Garmin calendar with the next Garmin import.",
  };
}

/** The modal's settings row: FTP override and swim stage. */
export async function saveWorkoutSettings(values: unknown): Promise<void> {
  const profile = await ownerProfile();
  const patch = workoutSettingsPatchSchema.parse(values);
  await updateWorkoutSettings(profile.id, patch);
  refresh();
}
