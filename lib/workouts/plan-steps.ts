import type { PlannedWorkout } from "@/lib/data/planned";
import { METERS_PER_MILE } from "@/lib/running/runs";
import { lengthLabel, STEP_LABELS, targetLabel, type DescribeContext } from "./describe";
import type { Block, Step } from "./types";

/**
 * A planned session's steps as display rows, for the planner's workout modal. Two sources share
 * planned_workouts.steps:
 * - the tracker's own workouts (source 'self'): the builder's blocks (lib/workouts/types.ts);
 * - Garmin calendar workouts, Runna's included (source 'garmin'): Garmin's steps cut down by
 *   scripts/garmin/import_unofficial.py (compact_step).
 * Pure, unit-tested.
 */

export interface StepRow {
  kind: "step";
  /** "Warm up", "Run", "Recover"... */
  label: string;
  /** "10 min", "0.5 mi", "until lap" */
  length: string | null;
  /** "11:25–12:25 /mi", "Zone 2 · 121–140 bpm", "200–220 W" */
  target: string | null;
  note: string | null;
}

export interface RepeatRow {
  kind: "repeat";
  times: number;
  steps: StepRow[];
}

export type PlanStepRow = StepRow | RepeatRow;

/** One step as compact_step writes it. */
interface GarminStep {
  kind?: string;
  end?: string;
  value?: number;
  target?: string;
  lo?: number;
  hi?: number;
  zone?: number;
  note?: string;
}
interface GarminRepeat {
  repeat: number;
  steps: GarminStep[];
}

const GARMIN_KINDS: Record<string, string> = {
  warmup: "Warm up",
  cooldown: "Cool down",
  interval: "Work",
  active: "Work",
  recovery: "Recover",
  rest: "Rest",
  main: "Work",
  other: "Step",
};

/** "45 s", "5 min", "4:30", "1 h 10 min" */
function fmtTime(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return s % 60 ? `${m}:${String(s % 60).padStart(2, "0")}` : `${m} min`;
}

/** Short distances in meters (track reps), the rest in miles: "400 m", "0.75 mi", "3 mi". */
export function fmtDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (meters < 1000 && Math.abs(miles * 4 - Math.round(miles * 4)) > 0.005) return `${Math.round(meters)} m`;
  return `${Number(miles.toFixed(2))} mi`;
}

/** Meters per second -> "11:25" per mile. */
function pacePerMile(mps: number): string {
  const total = Math.round(METERS_PER_MILE / mps);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function garminLength(s: GarminStep): string | null {
  if (s.end === "time" && s.value) return fmtTime(s.value);
  if (s.end === "distance" && s.value) return fmtDistance(s.value);
  if (s.end === "lap.button") return "until lap";
  return null;
}

function garminTarget(s: GarminStep, ctx: Pick<DescribeContext, "hrZones">): string | null {
  const { lo, hi } = s;
  switch (s.target) {
    case "pace.zone":
    case "speed.zone": {
      if (!lo || !hi) return null;
      // Faster speed first is the faster pace: show slow-to-fast ascending numbers, "9:45–10:15 /mi".
      const [fast, slow] = lo > hi ? [lo, hi] : [hi, lo];
      return `${pacePerMile(fast)}–${pacePerMile(slow)} /mi`;
    }
    case "heart.rate.zone": {
      if (lo && hi) return `${Math.round(Math.min(lo, hi))}–${Math.round(Math.max(lo, hi))} bpm`;
      if (s.zone) {
        const bounds = ctx.hrZones?.[s.zone - 1];
        return bounds ? `Zone ${s.zone} · ${bounds[0]}–${bounds[1]} bpm` : `HR zone ${s.zone}`;
      }
      return null;
    }
    case "power.zone":
      if (lo && hi) return `${Math.round(Math.min(lo, hi))}–${Math.round(Math.max(lo, hi))} W`;
      return s.zone ? `Power zone ${s.zone}` : null;
    case "cadence":
      return lo && hi ? `${Math.round(Math.min(lo, hi))}–${Math.round(Math.max(lo, hi))} rpm` : null;
    default:
      return null;
  }
}

function garminRow(s: GarminStep, ctx: Pick<DescribeContext, "hrZones">): StepRow {
  return {
    kind: "step",
    label: GARMIN_KINDS[s.kind ?? ""] ?? "Step",
    length: garminLength(s),
    target: garminTarget(s, ctx),
    note: s.note ?? null,
  };
}

function ownRow(s: Step, ctx: DescribeContext): StepRow {
  const extras = [s.stroke && s.stroke !== "drill" ? s.stroke : null, s.equipment?.replace("_", " ")].filter(Boolean);
  return {
    kind: "step",
    label: STEP_LABELS[s.kind],
    length: lengthLabel(s, ctx),
    target: targetLabel(s.target, ctx),
    note: [s.note, ...extras].filter(Boolean).join(" · ") || null,
  };
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** The session's steps as rows, or [] when it has none stored (Coach sessions, rows imported
 * before steps were kept). */
export function planSteps(w: Pick<PlannedWorkout, "source" | "steps">, ctx: DescribeContext): PlanStepRow[] {
  const steps = (w.steps ?? []).filter(isObject);
  if (w.source === "self") {
    return (steps as unknown as Block[]).map((b): PlanStepRow =>
      b.kind === "repeat" ? { kind: "repeat", times: b.times, steps: b.steps.map((s) => ownRow(s, ctx)) } : ownRow(b, ctx),
    );
  }
  return (steps as unknown as (GarminStep | GarminRepeat)[]).map((s): PlanStepRow =>
    "repeat" in s ? { kind: "repeat", times: s.repeat, steps: (s.steps ?? []).filter(isObject).map((x) => garminRow(x, ctx)) } : garminRow(s, ctx),
  );
}
