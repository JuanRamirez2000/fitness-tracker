import { describe, expect, it } from "vitest";
import { buildWorkout, kindsFor, resolveKind } from "./build";
import { stepLine, workoutLines } from "./describe";
import { toGarminWorkout } from "./garmin";
import { coachedSports, phaseOn, warningsFor, weekPlan, type PlannedSession } from "./plan";
import { effectiveFtp, parseWorkoutSettings } from "./settings";
import { bestFit } from "./steps";
import type { Block, Step } from "./types";

const CTX = { swimStage: 0 as const, ftpW: 139 };
const POOL = { length: 25, unit: "yard" as const };
const DESCRIBE = { ftpW: 139, hrZones: [[101, 120], [121, 140], [141, 160], [161, 180], [181, 201]] as [number, number][], pool: POOL };

function flat(blocks: Block[]): Step[] {
  return blocks.flatMap((b) => (b.kind === "repeat" ? b.steps : [b]));
}

describe("buildWorkout", () => {
  it.each([
    ["run", "easy", 30],
    ["run", "tempo", 45],
    ["run", "intervals", 45],
    ["ride", "endurance", 60],
    ["ride", "sweetspot", 50],
    ["ride", "threshold", 55],
    ["swim", "skills", 30],
  ] as const)("%s %s fills about %d minutes", (sport, kind, minutes) => {
    const w = buildWorkout({ sport, kind, effort: 3, minutes }, CTX);
    expect(w.kind).toBe(kind);
    expect(Math.abs(w.seconds / 60 - minutes)).toBeLessThanOrEqual(4);
  });

  it("auto picks the template by effort", () => {
    expect(buildWorkout({ sport: "run", kind: "auto", effort: 2, minutes: 30 }, CTX).kind).toBe("easy");
    expect(buildWorkout({ sport: "ride", kind: "auto", effort: 4, minutes: 50 }, CTX).kind).toBe("sweetspot");
  });

  it("clamps minutes to the template's range", () => {
    const w = buildWorkout({ sport: "run", kind: "brick", effort: 2, minutes: 90 }, CTX);
    expect(w.seconds).toBeLessThanOrEqual(30 * 60);
  });

  it("keeps swim templates above the athlete's stage out", () => {
    expect(kindsFor("swim", CTX).map((k) => k.key)).toEqual(["skills"]);
    expect(resolveKind("swim", "race", 5, CTX).key).toBe("skills");
    expect(kindsFor("swim", { ...CTX, swimStage: 3 }).map((k) => k.key)).toEqual(["skills", "build", "endurance", "race"]);
  });

  it("rides fall back to HR zones without an FTP", () => {
    const w = buildWorkout({ sport: "ride", kind: "sweetspot", effort: 4, minutes: 50 }, { ...CTX, ftpW: null });
    expect(flat(w.blocks).every((s) => s.target.by !== "power")).toBe(true);
  });

  it("a beginner's swim is drills, kicking and rest, never a freestyle length", () => {
    const steps = flat(buildWorkout({ sport: "swim", kind: "auto", effort: 2, minutes: 25 }, CTX).blocks);
    expect(steps.some((s) => s.stroke === "free")).toBe(false);
    expect(steps.some((s) => s.equipment === "kickboard")).toBe(true);
    expect(steps.some((s) => s.kind === "rest")).toBe(true);
  });
});

describe("bestFit", () => {
  it("picks the block length and count closest to the time", () => {
    expect(bestFit(30 * 60, [6, 8, 10].map((m) => m * 60), 120, 2, 4)).toEqual({ blockSeconds: 480, times: 3 });
  });
});

describe("toGarminWorkout", () => {
  it("power targets go as watts rounded to 5, HR targets as Garmin zones", () => {
    const ride = toGarminWorkout(buildWorkout({ sport: "ride", kind: "sweetspot", effort: 4, minutes: 50 }, CTX), { ftpW: 139, pool: POOL });
    const steps = (ride.workoutSegments as { workoutSteps: Record<string, unknown>[] }[])[0].workoutSteps;
    const work = (steps[1].workoutSteps as Record<string, unknown>[])[0];
    expect(work.targetValueOne).toBe(120);
    expect(work.targetValueTwo).toBe(130);
    expect(ride.sportType).toMatchObject({ sportTypeKey: "cycling" });

    const run = toGarminWorkout(buildWorkout({ sport: "run", kind: "easy", effort: 2, minutes: 30 }, CTX), { ftpW: null, pool: POOL });
    const runSteps = (run.workoutSegments as { workoutSteps: Record<string, unknown>[] }[])[0].workoutSteps;
    expect(runSteps[1]).toMatchObject({ zoneNumber: 2, targetType: { workoutTargetTypeKey: "heart.rate.zone" } });
  });

  it("swims carry the pool, lengths in meters, fixed rest and strokes", () => {
    const swim = toGarminWorkout(buildWorkout({ sport: "swim", kind: "build", effort: 3, minutes: 30 }, { ...CTX, swimStage: 1 }), { ftpW: null, pool: POOL });
    expect(swim).toMatchObject({ poolLength: 25, poolLengthUnit: { unitKey: "yard" } });
    const steps = (swim.workoutSegments as { workoutSteps: Record<string, unknown>[] }[])[0].workoutSteps;
    const [length, rest] = steps[1].workoutSteps as Record<string, unknown>[];
    expect(length).toMatchObject({ endConditionValue: 22.86, strokeType: { strokeTypeKey: "free" } });
    expect(rest).toMatchObject({ endCondition: { conditionTypeKey: "fixed.rest" } });
    expect(rest.targetType).toBeUndefined();
  });

  it("numbers steps in order through repeat groups", () => {
    const w = toGarminWorkout(buildWorkout({ sport: "run", kind: "strides", effort: 3, minutes: 30 }, CTX), { ftpW: null, pool: POOL });
    const steps = (w.workoutSegments as { workoutSteps: Record<string, unknown>[] }[])[0].workoutSteps;
    const orders = steps.flatMap((s) => [s.stepOrder, ...((s.workoutSteps as Record<string, unknown>[] | undefined) ?? []).map((c) => c.stepOrder)]);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("describe", () => {
  it("names targets in the athlete's own numbers", () => {
    const w = buildWorkout({ sport: "ride", kind: "sweetspot", effort: 4, minutes: 50 }, CTX);
    expect(workoutLines(w.blocks, DESCRIBE).join("\n")).toContain("120–130 W");
    expect(stepLine({ kind: "work", length: { by: "time", seconds: 600 }, target: { by: "hr", zone: 2 } }, DESCRIBE)).toBe("Work · 10 min · Zone 2 · 121–140 bpm");
    expect(stepLine({ kind: "work", length: { by: "lengths", count: 2 }, target: { by: "none" }, stroke: "free" }, DESCRIBE)).toBe(
      "Work · 2 lengths (50 yd) · freestyle",
    );
  });
});

describe("settings", () => {
  it("defaults to the Lake Perris sprint, a 25 yd pool and Sunday swims", () => {
    const s = parseWorkoutSettings(null);
    expect(s.race?.date).toBe("2027-04-11");
    expect(s.pool).toEqual(POOL);
    expect(s.swim_days).toEqual([0]);
  });

  it("FTP: own setting, then 95% of best 20 minutes, then Garmin's", () => {
    const s = parseWorkoutSettings({});
    expect(effectiveFtp({ ...s, ftp_w: 180 }, 146, 222)).toEqual({ watts: 180, source: "setting" });
    expect(effectiveFtp(s, 146, 222)).toEqual({ watts: 139, source: "estimate" });
    expect(effectiveFtp(s, null, 222)).toEqual({ watts: 222, source: "garmin" });
  });
});

describe("phaseOn", () => {
  const race = { name: "Sprint", date: "2027-04-11" };
  it.each([
    ["2026-11-14", "base"],
    ["2027-01-03", "build"],
    ["2027-03-29", "taper"],
    ["2027-04-11", "race"],
    ["2027-04-20", "recovery"],
    ["2027-06-01", "offseason"],
  ])("%s is %s", (today, key) => {
    expect(phaseOn(today, race).key).toBe(key);
  });
});

// The week the Cycling Coach plan had on 2026-11-14: long ride Sat, base Sun, rest Mon,
// tempo Tue (key), base Wed, rest Thu.
const COACH: PlannedSession[] = [
  ["2026-11-14", "Long Ride", 5400, true, false],
  ["2026-11-15", "Base", 5400, false, false],
  ["2026-11-16", null, null, false, true],
  ["2026-11-17", "Tempo", 3720, true, false],
  ["2026-11-18", "Base", 3180, false, false],
  ["2026-11-19", null, null, false, true],
  ["2026-11-20", "Anaerobic", 4140, true, false],
].map(([local_date, name, duration_s, key_workout, rest_day], i) => ({
  workout_uuid: `c${i}`,
  local_date: local_date as string,
  sport: rest_day ? null : "cycling",
  name: name as string | null,
  duration_s: duration_s as number | null,
  key_workout: key_workout as boolean,
  rest_day: rest_day as boolean,
  plan_name: "2027 Fitness Plan",
  source: "garmin" as const,
}));

const RECENT = [
  { local_date: "2026-11-09", activity_type: "running", duration_s: 32 * 60 },
  { local_date: "2026-11-07", activity_type: "running", duration_s: 34 * 60 },
  { local_date: "2026-11-04", activity_type: "running", duration_s: 20 * 60 },
  { local_date: "2026-11-12", activity_type: "indoor_cycling", duration_s: 21 * 60 },
];

describe("weekPlan", () => {
  const plan = weekPlan({ today: "2026-11-14", planned: COACH, recent: RECENT, settings: parseWorkoutSettings(null) });

  it("sees cycling as coached", () => {
    expect(coachedSports(COACH, "2026-11-14")).toEqual(["ride"]);
    expect(plan.coached).toEqual(["ride"]);
  });

  it("suggests a Sunday swim, an easy run on the first rest day and a brick after the long ride, no rides", () => {
    const byKey = plan.suggestions.map((s) => `${s.date} ${s.sport} ${s.kind}`);
    expect(byKey).toContain("2026-11-15 swim auto");
    expect(byKey).toContain("2026-11-16 run easy");
    expect(byKey).toContain("2026-11-14 run brick");
    expect(plan.suggestions.some((s) => s.sport === "ride")).toBe(false);
  });

  it("keeps the last rest day of the week fully off", () => {
    expect(plan.suggestions.some((s) => s.date === "2026-11-19")).toBe(false);
  });

  it("reads recent running", () => {
    expect(plan.longestRecent.run).toBe(34);
    expect(plan.typicalRecent.run).toBe(32);
  });

  it("warns about hard efforts before a key session, the hour limit and big jumps", () => {
    const warnings = warningsFor({ sport: "run", date: "2026-11-16", effort: 4, minutes: 60 }, plan);
    expect(warnings.join(" ")).toMatch(/next day has a key Coach session \(Tempo\)/);
    expect(warnings.join(" ")).toMatch(/rest day/);
    expect(warnings.join(" ")).toMatch(/over your 7 h limit/);
    expect(warnings.join(" ")).toMatch(/Longer than any run/);
  });

  it("treats a running Coach plan the other way round", () => {
    const running = COACH.map((s) => ({ ...s, sport: s.sport ? "running" : null }));
    const p = weekPlan({ today: "2026-11-14", planned: running, recent: RECENT, settings: parseWorkoutSettings(null) });
    expect(p.coached).toEqual(["run"]);
    expect(p.suggestions.some((s) => s.sport === "ride")).toBe(true);
    expect(p.suggestions.some((s) => s.sport === "run")).toBe(false);
  });
});
