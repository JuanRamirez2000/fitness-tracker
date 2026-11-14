import type { PlannedWorkout } from "@/lib/data/planned";
import type { PlannedSession } from "./plan";

/** A planned_workouts row as the planner sees it. Pure (safe in client components). */
export function toPlannedSession(w: PlannedWorkout): PlannedSession {
  return {
    workout_uuid: w.workout_uuid,
    local_date: w.local_date,
    sport: w.sport,
    name: w.name,
    duration_s: w.duration_s,
    rest_day: w.rest_day,
    key_workout: w.key_workout,
    plan_name: w.plan_name,
    source: w.source,
  };
}
