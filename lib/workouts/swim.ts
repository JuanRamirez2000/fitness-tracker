import { LAP, NO_TARGET, lengths, repeat, seconds, step } from "./steps";
import type { BuildContext, Built, SportTemplates } from "./templates";
import type { SwimStage } from "./settings";
import type { Block, Effort } from "./types";

/**
 * Pool swim workouts in pool lengths, from "can't swim a length yet" to 400 yd nonstop (the
 * Lake Perris sprint swim). No HR targets in the water: the notes say how it should feel, and
 * rest is a fixed number of seconds at the wall. Drills end on the lap button, since the watch
 * can't count a kickboard length.
 */

const KINDS = [
  { key: "skills", label: "Skills", blurb: "Breathing, floating, kicking with a board", minutes: [15, 45, 25], minSwimStage: 0 },
  { key: "build", label: "Build", blurb: "Single lengths with rest, plus drills", minutes: [20, 50, 30], minSwimStage: 1 },
  { key: "endurance", label: "Endurance", blurb: "100s with short rest", minutes: [25, 60, 35], minSwimStage: 2 },
  { key: "race", label: "Race prep", blurb: "Toward 400 yd nonstop, sighting", minutes: [25, 60, 35], minSwimStage: 3 },
] satisfies SportTemplates["kinds"];

/** Seconds per length at each stage (with a board early on), for the time estimate. */
const SECONDS_PER_LENGTH: Record<SwimStage, number> = { 0: 75, 1: 60, 2: 45, 3: 40, 4: 35 };

function pace(ctx: BuildContext) {
  return { secondsPerLength: SECONDS_PER_LENGTH[ctx.swimStage], secondsPerLap: 75 };
}

function auto(effort: Effort, ctx: BuildContext): string {
  const usable = KINDS.filter((k) => k.minSwimStage <= ctx.swimStage);
  // Higher effort leans to the hardest template the stage allows; easy days take one step down.
  const index = effort <= 2 ? Math.max(0, usable.length - 2) : usable.length - 1;
  return usable[index].key;
}

/** Rest at the wall: more on easy days, less when pushing. */
function rest(effort: Effort, base: number): number {
  return Math.max(10, base + (3 - effort) * 10);
}

/** How many sets of `setSeconds` best fill the main-set time. */
function fit(mainSeconds: number, setSeconds: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(mainSeconds / setSeconds)));
}

function build(kind: string, effort: Effort, m: number, ctx: BuildContext): Built {
  const perLength = SECONDS_PER_LENGTH[ctx.swimStage];
  // The main set's time: the total less the warm-up and cool-down (about 3 lengths' worth).
  const main = m * 60 - 3 * Math.max(perLength, 75);
  switch (kind) {
    case "build": {
      const r = rest(effort, 40);
      const n = fit(main * 0.6, perLength + r, 4, 24);
      const drills = fit(main * 0.4, 75 + 30, 2, 6);
      return {
        kind,
        name: `Swim build ${n}×1 length`,
        why: "Single lengths with plenty of rest grow your freestyle one wall at a time, toward swimming 100 yards.",
        blocks: [
          step("warmup", lengths(2), NO_TARGET, { stroke: "drill", equipment: "kickboard", note: "Kick with the board, easy" }),
          repeat(n, [
            step("work", lengths(1), NO_TARGET, { stroke: "free", note: "Smooth, long strokes. Breathe every 2 or 3" }),
            step("rest", seconds(r), NO_TARGET),
          ]),
          repeat(drills, [
            step("work", LAP, NO_TARGET, { stroke: "drill", note: "Side kick: one arm out front, roll to breathe, then back" }),
            step("rest", seconds(30), NO_TARGET),
          ]),
          step("cooldown", lengths(1), NO_TARGET, { stroke: "any", note: "Any stroke, very easy" }),
        ],
      };
    }
    case "endurance": {
      const r = rest(effort, 30);
      const n = fit(main * 0.75, perLength * 4 + r, 2, 12);
      return {
        kind,
        name: `Swim endurance ${n}×100`,
        why: "100s with short rest build the aerobic engine for 400 yards in the lake.",
        blocks: [
          step("warmup", lengths(4), NO_TARGET, { stroke: "any", note: "Easy, mix in kick" }),
          repeat(n, [
            step("work", lengths(4), NO_TARGET, { stroke: "free", note: "Steady. Same pace on every 100" }),
            step("rest", seconds(r), NO_TARGET),
          ]),
          repeat(2, [
            step("work", lengths(1), NO_TARGET, { stroke: "drill", equipment: "kickboard", note: "Kick" }),
            step("rest", seconds(20), NO_TARGET),
          ]),
          step("cooldown", lengths(2), NO_TARGET, { stroke: "any", note: "Easy" }),
        ],
      };
    }
    case "race": {
      const continuous = ctx.swimStage >= 4 ? 16 : 8;
      const blocks: Block[] = [
        step("warmup", lengths(4), NO_TARGET, { stroke: "any", note: "Easy" }),
        step("work", lengths(continuous), NO_TARGET, {
          stroke: "free",
          note: continuous === 16 ? "400 nonstop at race effort. Lift your eyes to sight every 6 strokes" : "200 nonstop. Sight every 6 strokes",
        }),
        step("rest", seconds(60), NO_TARGET),
      ];
      const leftover = main - continuous * perLength - 60;
      const fast = fit(leftover, perLength * 2 + rest(effort, 30), 2, 10);
      blocks.push(
        repeat(fast, [
          step("work", lengths(2), NO_TARGET, { stroke: "free", note: "Fast start, like the beach start, then settle" }),
          step("rest", seconds(rest(effort, 30)), NO_TARGET),
        ]),
        step("cooldown", lengths(2), NO_TARGET, { stroke: "any", note: "Easy" }),
      );
      return {
        kind,
        name: `Swim race prep ${continuous * 25}`,
        why: "A long nonstop swim plus fast starts gets you ready for the 400 in the lake.",
        blocks,
      };
    }
    case "skills":
    default: {
      const kicks = fit(main * 0.45, 75 + rest(effort, 45), 3, 10);
      const glides = fit(main * 0.3, 75 + 30, 2, 6);
      const sideKicks = fit(main * 0.25, 75 + 30, 2, 6);
      return {
        kind: "skills",
        name: "Swim skills",
        why: "Comfort first: breathing out underwater, floating and kicking are the base every freestyle length is built on.",
        blocks: [
          step("warmup", LAP, NO_TARGET, {
            stroke: "drill",
            note: "Shallow end: 10 bubbles. Breathe in above water, blow out slowly through your nose underwater",
          }),
          repeat(kicks, [
            step("work", lengths(1), NO_TARGET, { stroke: "drill", equipment: "kickboard", note: "Kick with the board. Small, fast kicks from the hips" }),
            step("rest", seconds(rest(effort, 45)), NO_TARGET),
          ]),
          repeat(glides, [
            step("work", LAP, NO_TARGET, { stroke: "drill", note: "Push off, face in, arms out front. Glide and kick as far as you can" }),
            step("rest", seconds(30), NO_TARGET),
          ]),
          repeat(sideKicks, [
            step("work", LAP, NO_TARGET, { stroke: "drill", note: "Side kick, one arm out front, face rolls up to breathe. Fins help if you have them" }),
            step("rest", seconds(30), NO_TARGET),
          ]),
          step("cooldown", LAP, NO_TARGET, { stroke: "any", note: "Float on your back for 30 seconds, then easy kick" }),
        ],
      };
    }
  }
}

export const SWIM: SportTemplates = { kinds: KINDS, auto, build, pace };
