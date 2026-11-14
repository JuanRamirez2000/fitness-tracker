import type { ActiveSport } from "@/lib/sport";
import type { LocalDate } from "@/lib/dates/calendar";

/**
 * The tracker's own workout model: what the "Plan a workout" modal previews, what
 * planned_workouts.steps stores, and what lib/workouts/garmin.ts turns into a Garmin workout.
 * Sport-agnostic: a run, a ride and a swim are the same blocks with different targets.
 */

/** 1 Recovery ... 5 Very hard: the modal's effort slider. */
export type Effort = 1 | 2 | 3 | 4 | 5;
export const EFFORTS: readonly Effort[] = [1, 2, 3, 4, 5];
export const EFFORT_LABELS: Record<Effort, string> = { 1: "Recovery", 2: "Easy", 3: "Steady", 4: "Hard", 5: "Very hard" };

export type StepKind = "warmup" | "work" | "recover" | "rest" | "cooldown";

/** How long a step lasts: a time, a number of pool lengths, or until the lap button (drills). */
export type StepLength = { by: "time"; seconds: number } | { by: "lengths"; count: number } | { by: "lap" };

/** What to aim for: a heart-rate zone (Garmin's own zones), a power range as fractions of FTP
 * (ERG mode on the Kickr), or nothing (the note says how it should feel). */
export type Target = { by: "hr"; zone: 1 | 2 | 3 | 4 | 5 } | { by: "power"; low: number; high: number } | { by: "none" };

export type Stroke = "free" | "any" | "drill" | "back" | "breast";
export type Equipment = "kickboard" | "pull_buoy" | "fins";

export interface Step {
  kind: StepKind;
  length: StepLength;
  target: Target;
  /** Shown on the watch and in the preview: how it should feel, what to focus on. */
  note?: string;
  stroke?: Stroke;
  equipment?: Equipment;
}

export interface Repeat {
  kind: "repeat";
  times: number;
  steps: Step[];
}

export type Block = Step | Repeat;

export interface Workout {
  sport: ActiveSport;
  /** The template it came from: "easy", "sweetspot", "skills"... */
  kind: string;
  /** "Easy run", "Sweet spot 3×10": the name on the watch. */
  name: string;
  /** One or two plain sentences: what it's for. */
  why: string;
  blocks: Block[];
  /** Estimated total time (swim lengths and lap-button steps are estimated). */
  seconds: number;
}

/** What the modal and the CLI ask for. `kind` "auto" lets the effort pick the template. */
export interface WorkoutRequest {
  sport: ActiveSport;
  date: LocalDate;
  kind: string;
  effort: Effort;
  minutes: number;
}
