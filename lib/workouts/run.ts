import { NO_TARGET, bestFit, clamp, hr, minutes, repeat, repsThatFit, seconds, step } from "./steps";
import type { Built, SportTemplates } from "./templates";
import type { Block, Effort } from "./types";

/**
 * Run workouts, with Garmin heart-rate zone targets (the chest strap makes HR reliable). Built to
 * keep running fitness while another sport is coached: mostly zone 2, one quality session a
 * week, short bricks off the bike.
 */

const KINDS = [
  { key: "recovery", label: "Recovery", blurb: "Very easy, walk breaks welcome", minutes: [15, 40, 20] },
  { key: "easy", label: "Easy", blurb: "Conversational zone 2", minutes: [20, 60, 30] },
  { key: "strides", label: "Strides", blurb: "Easy run with short fast pick-ups", minutes: [25, 50, 30] },
  { key: "tempo", label: "Tempo", blurb: "Comfortably hard blocks", minutes: [30, 60, 40] },
  { key: "hills", label: "Hills", blurb: "Short uphill repeats", minutes: [25, 50, 35] },
  { key: "intervals", label: "Intervals", blurb: "3-minute hard repeats", minutes: [30, 55, 40] },
  { key: "long", label: "Long", blurb: "Weekend long and easy", minutes: [40, 90, 50] },
  { key: "brick", label: "Brick", blurb: "Short run straight off the bike", minutes: [10, 30, 15] },
] satisfies SportTemplates["kinds"];

function auto(effort: Effort): string {
  return (["recovery", "easy", "strides", "tempo", "intervals"] as const)[effort - 1];
}

function build(kind: string, effort: Effort, total: number): Built {
  const m = total;
  switch (kind) {
    case "recovery":
      return {
        kind,
        name: `Recovery run ${m} min`,
        why: "Loosens the legs and keeps the running habit without adding fatigue.",
        blocks: [step("work", minutes(m), hr(1), { note: "Very easy. Walk whenever HR drifts up." })],
      };
    case "strides": {
      const n = effort <= 2 ? 4 : effort === 3 ? 6 : 8;
      const stridesS = n * 80;
      const easyM = Math.max(5, m - 10 - 3 - stridesS / 60);
      return {
        kind,
        name: `Easy + ${n} strides`,
        why: "Easy aerobic running, plus strides to keep leg speed and form while the bike gets the hard work.",
        blocks: [
          step("warmup", minutes(10), hr(2), { note: "Easy jog" }),
          step("work", minutes(easyM), hr(2)),
          repeat(n, [
            step("work", seconds(20), NO_TARGET, { note: "Relaxed fast: quick feet, not a sprint" }),
            step("recover", seconds(60), NO_TARGET, { note: "Walk or jog" }),
          ]),
          step("cooldown", minutes(3), NO_TARGET),
        ],
      };
    }
    case "tempo": {
      const zone = effort >= 4 ? 4 : 3;
      const fitted = bestFit((m - 15) * 60, [5, 6, 8, 10, 12, 15].map((b) => b * 60), 120, 2, 4);
      const blockM = fitted.blockSeconds / 60;
      const n = fitted.times;
      return {
        kind,
        name: `Tempo ${n}×${blockM} min`,
        why: "Comfortably hard blocks build the pace you can hold for a 5K off the bike.",
        blocks: [
          step("warmup", minutes(10), hr(2)),
          repeat(n, [step("work", minutes(blockM), hr(zone)), step("recover", minutes(2), hr(2), { note: "Easy jog" })]),
          step("cooldown", minutes(5), NO_TARGET),
        ],
      };
    }
    case "hills": {
      const n = repsThatFit((m - 15) * 60, 60, 90, 4, 10);
      return {
        kind,
        name: `Hills ${n}×60 s`,
        why: "Uphill repeats build running strength with less pounding than flat speed work.",
        blocks: [
          step("warmup", minutes(10), hr(2)),
          repeat(n, [
            step("work", seconds(60), hr(4), { note: "Uphill: strong, tall, quick arms" }),
            step("recover", seconds(90), NO_TARGET, { note: "Jog or walk back down" }),
          ]),
          step("cooldown", minutes(5), NO_TARGET),
        ],
      };
    }
    case "intervals": {
      const zone = effort >= 5 ? 5 : 4;
      const n = repsThatFit((m - 15) * 60, 180, 120, 3, 8);
      return {
        kind,
        name: `Intervals ${n}×3 min`,
        why: "Hard 3-minute repeats raise the top end. Keep it to one of these a week at most.",
        blocks: [
          step("warmup", minutes(10), hr(2)),
          repeat(n, [step("work", minutes(3), hr(zone)), step("recover", minutes(2), NO_TARGET, { note: "Easy jog" })]),
          step("cooldown", minutes(5), NO_TARGET),
        ],
      };
    }
    case "long":
      return {
        kind,
        name: `Long run ${m} min`,
        why: "The week's longest run, all easy, to hold your aerobic base for the race.",
        blocks: [
          step("warmup", minutes(5), NO_TARGET, { note: "Ease in" }),
          step("work", minutes(m - 5), hr(2), { note: "Conversational. Walk up steep hills if HR climbs." }),
        ],
      };
    case "brick": {
      const firstM = Math.min(5, Math.max(3, Math.round(m / 3)));
      const blocks: Block[] = [
        step("work", minutes(firstM), hr(2), { note: "Straight off the bike: short, quick steps until the legs come back" }),
        step("work", minutes(Math.max(2, m - firstM - 2)), hr(effort >= 3 ? 3 : 2), { note: "Settle into race rhythm" }),
        step("cooldown", minutes(2), NO_TARGET, { note: "Walk" }),
      ];
      return {
        kind,
        name: `Brick run ${m} min`,
        why: "Running right after a ride teaches your legs the bike-to-run switch you'll do on race day.",
        blocks,
      };
    }
    case "easy":
    default:
      return {
        kind: "easy",
        name: `Easy run ${m} min`,
        why: "Easy zone 2 running holds your run fitness while the bike gets the hard sessions.",
        blocks: [step("warmup", minutes(5), NO_TARGET, { note: "Ease in" }), step("work", minutes(clamp(m - 5, 5, 120)), hr(2))],
      };
  }
}

export const RUN: SportTemplates = { kinds: KINDS, auto, build };
