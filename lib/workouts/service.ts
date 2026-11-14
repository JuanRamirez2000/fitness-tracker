import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PlannedWorkout } from "@/lib/data/planned";
import type { Profile } from "@/lib/data/profiles";
import { addDays, localDateSchema, type LocalDate } from "@/lib/dates/calendar";
import { SPORTS } from "@/lib/sport";
import { buildContext, buildWorkout } from "./build";
import { toGarminWorkout } from "./garmin";
import { weekPlan, type WeekPlan } from "./plan";
import { toPlannedSession } from "./session";
import { effectiveFtp, type WorkoutSettings } from "./settings";
import { fetchFtpInputs, fetchPlannedWorkouts, fetchRecentActivities, insertSelfWorkout } from "./store";
import type { Effort, Workout, WorkoutRequest } from "./types";

/**
 * The workout builder's server side, shared by the server actions (app/actions.ts), the Training
 * tab and `npm run workout`: what the week looks like, and saving a built workout. The server
 * always rebuilds the workout from the request, never trusting a client's copy.
 */

export const workoutRequestSchema = z.object({
  sport: z.enum(SPORTS),
  date: localDateSchema,
  kind: z.string().min(1).max(30),
  effort: z.number().int().min(1).max(5).transform((n) => n as Effort),
  minutes: z.number().int().min(5).max(240),
});

/** Everything the planner card, the modal and the CLI need. Serializable. */
export interface PlannerData {
  today: LocalDate;
  plan: WeekPlan;
  /** Coach sessions and own workouts from today through two weeks out. */
  planned: PlannedWorkout[];
  settings: WorkoutSettings;
  ftp: ReturnType<typeof effectiveFtp>;
  best20MinW: number | null;
  /** Garmin's run and cycling HR zones, [[low, high] x 5] bpm. */
  hrZones: { run: [number, number][] | null; ride: [number, number][] | null };
}

export const PLANNER_DAYS = 14;

export async function loadPlanner(profile: Profile, today: LocalDate): Promise<PlannerData> {
  const settings = profile.workout_settings;
  const [planned, recent, ftpInputs] = await Promise.all([
    fetchPlannedWorkouts(profile.id, { from: today, to: addDays(today, PLANNER_DAYS - 1) }),
    fetchRecentActivities(profile.id, addDays(today, -28)),
    fetchFtpInputs(profile.id, addDays(today, -90)),
  ]);
  return {
    today,
    plan: weekPlan({ today, planned: planned.map(toPlannedSession), recent, settings }),
    planned,
    settings,
    ftp: effectiveFtp(settings, ftpInputs.best20MinW, ftpInputs.garminFtpW),
    best20MinW: ftpInputs.best20MinW,
    hrZones: { run: profile.hr_zone_bounds, ride: profile.hr_zone_bounds_cycling ?? profile.hr_zone_bounds },
  };
}

/** Builds the workout for a request and saves it as an own workout, queued for Garmin or a
 * draft. Returns the new row's uuid and the workout. */
export async function saveWorkout(
  profileId: string,
  data: Pick<PlannerData, "settings" | "ftp">,
  request: WorkoutRequest,
  send: boolean,
): Promise<{ uuid: string; workout: Workout }> {
  const workout = buildWorkout(request, buildContext(data));
  const uuid = randomUUID();
  await insertSelfWorkout(profileId, {
    workout_uuid: uuid,
    local_date: request.date,
    sport: workout.sport,
    name: workout.name,
    description: workout.why,
    duration_s: workout.seconds,
    settings: { sport: request.sport, kind: workout.kind, effort: request.effort, minutes: request.minutes },
    steps: workout.blocks,
    garmin_workout: toGarminWorkout(workout, { ftpW: data.ftp.watts, pool: data.settings.pool }),
    push_status: send ? "queued" : "draft",
  });
  return { uuid, workout };
}
