import type { Block, Equipment, Step, StepKind, StepLength, Stroke, Target } from "./types";

/** Small constructors the sport templates share, plus the time estimate. Pure. */

export const NO_TARGET: Target = { by: "none" };

export function minutes(m: number): StepLength {
  return { by: "time", seconds: Math.round(m * 60) };
}

export function seconds(s: number): StepLength {
  return { by: "time", seconds: Math.round(s) };
}

export function lengths(count: number): StepLength {
  return { by: "lengths", count };
}

export const LAP: StepLength = { by: "lap" };

export function hr(zone: 1 | 2 | 3 | 4 | 5): Target {
  return { by: "hr", zone };
}

export function power(low: number, high: number): Target {
  return { by: "power", low, high };
}

export function step(
  kind: StepKind,
  length: StepLength,
  target: Target = NO_TARGET,
  extra: { note?: string; stroke?: Stroke; equipment?: Equipment } = {},
): Step {
  return { kind, length, target, ...extra };
}

export function repeat(times: number, steps: Step[]): Block {
  return { kind: "repeat", times, steps };
}

/** Seconds per step length when it isn't a time: a pool length at the athlete's swim pace, and
 * a lap-button drill at about a minute. */
export interface Pace {
  secondsPerLength: number;
  secondsPerLap: number;
}

const DEFAULT_PACE: Pace = { secondsPerLength: 45, secondsPerLap: 60 };

export function stepSeconds(s: Step, pace: Pace = DEFAULT_PACE): number {
  if (s.length.by === "time") return s.length.seconds;
  if (s.length.by === "lengths") return s.length.count * pace.secondsPerLength;
  return pace.secondsPerLap;
}

export function blockSeconds(b: Block, pace: Pace = DEFAULT_PACE): number {
  if (b.kind === "repeat") return b.times * b.steps.reduce((sum, s) => sum + stepSeconds(s, pace), 0);
  return stepSeconds(b, pace);
}

export function totalSeconds(blocks: Block[], pace: Pace = DEFAULT_PACE): number {
  return Math.round(blocks.reduce((sum, b) => sum + blockSeconds(b, pace), 0));
}

/** How many (work + recover) pairs fit in `availableSeconds` (a repeat runs its recovery after
 * the last one too), clamped to [min, max]. */
export function repsThatFit(availableSeconds: number, workSeconds: number, recoverSeconds: number, min: number, max: number): number {
  const n = Math.floor(availableSeconds / (workSeconds + recoverSeconds));
  return Math.max(min, Math.min(max, n));
}

/** The block length (from `optionsSeconds`) and count whose (work + recovery) pairs come closest
 * to `availableSeconds`; ties go to the longer block. */
export function bestFit(
  availableSeconds: number,
  optionsSeconds: number[],
  recoverSeconds: number,
  min: number,
  max: number,
): { blockSeconds: number; times: number } {
  let best = { blockSeconds: optionsSeconds[0], times: min, miss: Infinity };
  for (const blockSeconds of optionsSeconds) {
    for (let times = min; times <= max; times++) {
      const miss = Math.abs(times * (blockSeconds + recoverSeconds) - availableSeconds);
      if (miss < best.miss || (miss === best.miss && blockSeconds > best.blockSeconds)) best = { blockSeconds, times, miss };
    }
  }
  return { blockSeconds: best.blockSeconds, times: best.times };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
