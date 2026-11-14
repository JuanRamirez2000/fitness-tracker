import { NO_TARGET, bestFit, hr, minutes, power, repeat, step } from "./steps";
import type { BuildContext, Built, SportTemplates } from "./templates";
import type { Effort, Target } from "./types";

/**
 * Ride workouts. Indoors the targets are power ranges as fractions of FTP, which the Enduro 3
 * holds in ERG mode on the Kickr; with no FTP they fall back to cycling HR zones. The outdoor
 * ride uses HR (no ERG outside) and practices handling for race day.
 */

const KINDS = [
  { key: "recovery", label: "Recovery", blurb: "Spin, very light", minutes: [20, 45, 30] },
  { key: "endurance", label: "Endurance", blurb: "Steady zone 2", minutes: [30, 120, 45] },
  { key: "cadence", label: "Cadence", blurb: "Endurance with high-cadence drills", minutes: [30, 75, 45] },
  { key: "tempo", label: "Tempo", blurb: "Long steady blocks", minutes: [40, 90, 50] },
  { key: "sweetspot", label: "Sweet spot", blurb: "Just under threshold", minutes: [35, 90, 50] },
  { key: "threshold", label: "Threshold", blurb: "At FTP", minutes: [45, 75, 55] },
  { key: "vo2", label: "VO2 max", blurb: "3-minute hard repeats", minutes: [40, 70, 50] },
  { key: "outdoor", label: "Outdoor", blurb: "Easy ride outside: gears, corners, handling", minutes: [30, 150, 60] },
] satisfies SportTemplates["kinds"];

function auto(effort: Effort): string {
  return (["recovery", "endurance", "tempo", "sweetspot", "vo2"] as const)[effort - 1];
}

/** A power target, or the matching cycling HR zone when there's no FTP. */
function zone(ctx: BuildContext, low: number, high: number): Target {
  if (ctx.ftpW) return power(low, high);
  const mid = (low + high) / 2;
  return hr(mid < 0.56 ? 1 : mid < 0.76 ? 2 : mid < 0.9 ? 3 : mid < 1.05 ? 4 : 5);
}

function intervals(
  ctx: BuildContext,
  total: number,
  opts: { kind: string; label: string; blocksM: number[]; restM: number; low: number; high: number; min: number; max: number; why: string; warmupM?: number },
): Built {
  const warmupM = opts.warmupM ?? 10;
  const fitted = bestFit((total - warmupM - 5) * 60, opts.blocksM.map((b) => b * 60), opts.restM * 60, opts.min, opts.max);
  const n = fitted.times;
  const blockM = fitted.blockSeconds / 60;
  return {
    kind: opts.kind,
    name: `${opts.label} ${n}×${blockM}`,
    why: opts.why,
    blocks: [
      step("warmup", minutes(warmupM), zone(ctx, 0.45, 0.6), { note: "Build gradually" }),
      repeat(n, [
        step("work", minutes(blockM), zone(ctx, opts.low, opts.high)),
        step("recover", minutes(opts.restM), zone(ctx, 0.45, 0.55), { note: "Spin easy" }),
      ]),
      step("cooldown", minutes(5), zone(ctx, 0.4, 0.5)),
    ],
  };
}

function build(kind: string, effort: Effort, m: number, ctx: BuildContext): Built {
  switch (kind) {
    case "recovery":
      return {
        kind,
        name: `Recovery spin ${m} min`,
        why: "Light spinning moves blood through tired legs without adding training load.",
        blocks: [step("work", minutes(m), zone(ctx, 0.45, 0.55), { note: "Light, easy cadence" })],
      };
    case "cadence": {
      const n = Math.max(3, Math.min(8, Math.floor((m - 15) / 4)));
      return {
        kind,
        name: `Cadence drills ${n}×1 min`,
        why: "High-cadence drills smooth your pedal stroke, which saves your legs for the run.",
        blocks: [
          step("warmup", minutes(5), zone(ctx, 0.45, 0.6)),
          step("work", minutes(Math.max(5, m - 10 - n * 4)), zone(ctx, 0.6, 0.7)),
          repeat(n, [
            step("work", minutes(1), zone(ctx, 0.6, 0.7), { note: "High cadence: 100+ rpm, hips quiet" }),
            step("recover", minutes(3), zone(ctx, 0.6, 0.7), { note: "Back to normal cadence" }),
          ]),
          step("cooldown", minutes(5), zone(ctx, 0.45, 0.55)),
        ],
      };
    }
    case "tempo":
      return intervals(ctx, m, {
        kind, label: "Tempo", blocksM: [8, 10, 12, 15, 20], restM: 3, low: 0.76, high: 0.85, min: 2, max: 4,
        why: "Steady tempo blocks build the sustained power a 9-mile race leg needs.",
      });
    case "sweetspot":
      return intervals(ctx, m, {
        kind, label: "Sweet spot", blocksM: [6, 8, 10, 12, 15, 20], restM: 4, low: 0.88, high: 0.93, min: 2, max: 4,
        why: "Just under threshold: the most fitness per minute on the bike.",
      });
    case "threshold":
      return intervals(ctx, m, {
        kind, label: "Threshold", blocksM: [5, 6, 8, 10], restM: 4, low: 0.95, high: 1.02, min: 2, max: 5,
        why: "Efforts right at FTP raise the power you can hold for the whole bike leg.",
      });
    case "vo2":
      return intervals(ctx, m, {
        kind, label: "VO2", blocksM: [2, 3, 4], restM: 3, low: 1.08, high: 1.15, min: 3, max: 8, warmupM: 12,
        why: "Short, very hard repeats lift your ceiling. One a week at most.",
      });
    case "outdoor":
      return {
        kind,
        name: `Outdoor ride ${m} min`,
        why: "Race day is outside on this bike: practice shifting, cornering, drinking while riding and looking over your shoulder.",
        blocks: [
          step("warmup", minutes(10), NO_TARGET, { note: "Easy. Check brakes and gears." }),
          step("work", minutes(Math.max(10, m - 15)), hr(2), {
            note: "Easy zone 2. Practice: shift before hills, corner wide-in-wide-out, sip from the bottle",
          }),
          step("cooldown", minutes(5), NO_TARGET),
        ],
      };
    case "endurance":
    default: {
      const low = effort <= 2 ? 0.6 : 0.65;
      return {
        kind: "endurance",
        name: `Endurance ride ${m} min`,
        why: "Steady zone 2 riding builds the aerobic base every leg of the race draws on.",
        blocks: [
          step("warmup", minutes(5), zone(ctx, 0.45, 0.55)),
          step("work", minutes(Math.max(10, m - 10)), zone(ctx, low, low + 0.1)),
          step("cooldown", minutes(5), zone(ctx, 0.45, 0.55)),
        ],
      };
    }
  }
}

export const RIDE: SportTemplates = { kinds: KINDS, auto, build };
