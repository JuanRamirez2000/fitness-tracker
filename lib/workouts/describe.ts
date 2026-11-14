import type { Block, Step, StepKind, Stroke, Target } from "./types";

/** Plain-words labels for the preview, the CLI and the skill. Pure. */

export interface DescribeContext {
  ftpW: number | null;
  /** [[low, high] x 5] bpm, the sport's own Garmin zones, or null. */
  hrZones: [number, number][] | null;
  pool: { length: number; unit: "yard" | "meter" };
}

export const STEP_LABELS: Record<StepKind, string> = {
  warmup: "Warm up",
  work: "Work",
  recover: "Recover",
  rest: "Rest",
  cooldown: "Cool down",
};

const STROKES: Record<Stroke, string> = { free: "freestyle", any: "any stroke", drill: "drill", back: "backstroke", breast: "breaststroke" };

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

/** Watts, rounded to 5 the way the targets are sent to Garmin. */
export function watts(fraction: number, ftpW: number): number {
  return Math.round((fraction * ftpW) / 5) * 5;
}

export function lengthLabel(s: Step, ctx: DescribeContext): string {
  if (s.length.by === "time") return fmtDuration(s.length.seconds);
  if (s.length.by === "lap") return "until lap";
  const unit = ctx.pool.unit === "yard" ? "yd" : "m";
  const n = s.length.count;
  return `${n} length${n === 1 ? "" : "s"} (${n * ctx.pool.length} ${unit})`;
}

export function targetLabel(t: Target, ctx: DescribeContext): string | null {
  if (t.by === "hr") {
    const bounds = ctx.hrZones?.[t.zone - 1];
    return bounds ? `Zone ${t.zone} · ${bounds[0]}–${bounds[1]} bpm` : `HR zone ${t.zone}`;
  }
  if (t.by === "power") {
    if (!ctx.ftpW) return `${Math.round(t.low * 100)}–${Math.round(t.high * 100)}% FTP`;
    return `${watts(t.low, ctx.ftpW)}–${watts(t.high, ctx.ftpW)} W`;
  }
  return null;
}

/** "Warm up · 10 min · Zone 2 · 121–140 bpm · Easy jog" */
export function stepLine(s: Step, ctx: DescribeContext): string {
  const parts = [STEP_LABELS[s.kind], lengthLabel(s, ctx)];
  const target = targetLabel(s.target, ctx);
  if (target) parts.push(target);
  if (s.stroke && s.stroke !== "drill") parts.push(STROKES[s.stroke]);
  if (s.equipment) parts.push(s.equipment.replace("_", " "));
  if (s.note) parts.push(s.note);
  return parts.join(" · ");
}

/** The whole workout as indented lines, for the CLI and the skill. */
export function workoutLines(blocks: Block[], ctx: DescribeContext): string[] {
  return blocks.flatMap((b) =>
    b.kind === "repeat" ? [`${b.times}×`, ...b.steps.map((s) => `   ${stepLine(s, ctx)}`)] : [stepLine(b, ctx)],
  );
}

/** The training zone a step works in, 1..5, or 0 without a target (for the preview's colors):
 * HR zones as they are, power by fraction of FTP (Coggan-style bands folded into five). */
export function zoneOf(s: Step): 0 | 1 | 2 | 3 | 4 | 5 {
  if (s.target.by === "hr") return s.target.zone;
  if (s.target.by === "power") {
    const mid = (s.target.low + s.target.high) / 2;
    return mid < 0.56 ? 1 : mid < 0.76 ? 2 : mid < 0.9 ? 3 : mid < 1.05 ? 4 : 5;
  }
  return 0;
}

/** 0..1 intensity of a step, for the preview's bar chart: power by fraction of FTP, HR by
 * zone, everything else from the step kind. */
export function intensityOf(s: Step): number {
  if (s.target.by === "power") return Math.min(1, ((s.target.low + s.target.high) / 2) / 1.2);
  if (s.target.by === "hr") return s.target.zone / 5;
  if (s.kind === "rest") return 0.05;
  if (s.kind === "work") return 0.55;
  if (s.kind === "recover") return 0.25;
  return 0.3;
}
