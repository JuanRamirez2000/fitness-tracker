import { isRun, type Activity } from "@/lib/data/activities";
import type { DayWindow, LocalDate } from "@/lib/dates/calendar";

export const METERS_PER_MILE = 1609.344;

/**
 * The heart rate every easy run's pace is scaled to, so runs at different efforts compare:
 * a faster pace at the same heart rate means a fitter aerobic engine. 130 sits in the middle
 * of this athlete's easy runs (roughly 119-131 bpm), so the scaling stays small.
 */
export const EFFICIENCY_REF_HR = 130;

/**
 * Only easy runs averaging within this many bpm of EFFICIENCY_REF_HR are scored: pace and
 * heart rate are roughly proportional near easy effort, but Garmin also labels some 155-160
 * bpm runs "aerobic base", and scaling those down to 130 would mostly measure the scaling.
 */
const EFFICIENCY_HR_BAND = 15;

/** Shorter runs (warm-ups, a lap around the block) are too noisy to judge efficiency by. */
const MIN_EFFICIENCY_MILES = 1;

/** Garmin's own training-effect labels for an easy aerobic run; anything harder is a workout. */
const EASY_LABELS = new Set(["RECOVERY", "AEROBIC_BASE"]);

export type Run = Activity;

/** Every run, oldest first (activities already arrive that way). */
export function runsOf(activities: Activity[]): Run[] {
  return activities.filter(isRun);
}

export function runMiles(run: Run): number {
  return (run.distance_m ?? 0) / METERS_PER_MILE;
}

/** Grade-adjusted when Garmin has it, so a hilly run isn't scored as a slow one. */
export function runSpeedMps(run: Run): number | null {
  return run.avg_grade_adjusted_speed_mps ?? run.avg_speed_mps;
}

export function paceSecPerMile(speedMps: number): number {
  return METERS_PER_MILE / speedMps;
}

export function isEasyRun(run: Run): boolean {
  return run.training_effect_label !== null && EASY_LABELS.has(run.training_effect_label);
}

/**
 * An easy run's pace scaled to EFFICIENCY_REF_HR (speed × 130 / avg HR), in seconds per mile:
 * the pace it would have been at 130 bpm. Null for a workout, a run averaging outside
 * EFFICIENCY_HR_BAND, or one without heart rate, speed, or at least a mile of distance.
 */
export function easyPaceAtRefHr(run: Run): number | null {
  const speed = runSpeedMps(run);
  if (!isEasyRun(run) || !speed || !run.avg_hr || runMiles(run) < MIN_EFFICIENCY_MILES) return null;
  if (Math.abs(run.avg_hr - EFFICIENCY_REF_HR) > EFFICIENCY_HR_BAND) return null;
  return paceSecPerMile((speed * EFFICIENCY_REF_HR) / run.avg_hr);
}

export function runsIn(runs: Run[], window: DayWindow): Run[] {
  return runs.filter((r) => r.local_date >= window.from && r.local_date <= window.to);
}

export function totalMiles(runs: Run[]): number {
  return runs.reduce((sum, r) => sum + runMiles(r), 0);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 725 -> "12:05". Seconds per mile, or any duration under an hour. */
export function fmtPace(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 2_000 -> "33:20", 4_000 -> "1:06:40". */
export function fmtDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  return h > 0 ? `${h}:${fmtPace(total - h * 3600).padStart(5, "0")}` : fmtPace(total);
}

/** Runs grouped by day, for the heatmap and table, keyed by local date. */
export function runsByDate(runs: Run[]): Map<LocalDate, Run[]> {
  const byDate = new Map<LocalDate, Run[]>();
  for (const run of runs) {
    const day = byDate.get(run.local_date);
    if (day) day.push(run);
    else byDate.set(run.local_date, [run]);
  }
  return byDate;
}
