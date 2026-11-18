import { describe, expect, it } from "vitest";
import type { PlannedWorkout } from "@/lib/data/planned";
import { testRun, testTraining } from "@/lib/kpis/testing";
import { runRamp } from "@/lib/running/ramp";
import { planProgress, raceOf } from "./plans";

function session(date: string, over: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    workout_uuid: `${date}-${over.name ?? "run"}`,
    local_date: date,
    sport: "running",
    name: "Easy Run",
    description: null,
    duration_s: 2400,
    benefit: null,
    rest_day: false,
    key_workout: false,
    status: null,
    plan_name: "10k Plan",
    source: "garmin",
    settings: null,
    steps: null,
    push_status: null,
    push_error: null,
    pushed_at: null,
    provider: "Runna",
    duration_estimated: true,
    ...over,
  };
}

const week = (n: number) => `10k Plan (Week ${n}/12)\n\n3mi easy`;

describe("raceOf", () => {
  it("reads the race from the plan's name", () => {
    expect(raceOf("10k Plan")).toBe("race_10k_s");
    expect(raceOf("Half Marathon Plan")).toBe("race_half_s");
    expect(raceOf("Marathon Build")).toBe("race_marathon_s");
    expect(raceOf("5K Speed")).toBe("race_5k_s");
    expect(raceOf("2027 Fitness Plan")).toBeNull();
  });
});

describe("planProgress", () => {
  const planHistory = [
    session("2026-11-17", { description: week(1) }),
    session("2026-11-19", { name: "Tempo", key_workout: true, description: week(1) }),
    session("2026-11-21", { name: "Long Run", key_workout: true, description: week(1) }),
    session("2026-11-23", { description: week(2) }),
  ];
  const training = [
    testTraining({ local_date: "2026-11-14", race_10k_s: 3830, vo2max: 41.5 }),
    testTraining({ local_date: "2026-11-20", race_10k_s: 3800, vo2max: 42 }),
  ];

  it("finds the plan, its weeks from the week tags, and the race it's for", () => {
    const [p] = planProgress({ planHistory, training, activities: [], today: "2026-11-20" }, "2026-11-20");
    expect(p).toMatchObject({ who: "Runna", name: "10k Plan", sport: "run", start: "2026-11-16", end: "2027-02-07", week: 1, weeks: 12 });
    expect(p.metrics[0]).toMatchObject({ id: "race_10k_s", label: "Predicted 10K", change: -30, tone: "good" });
    expect(p.metrics[0].changeText).toBe("▼ 0:30 faster since Nov 14");
    expect(p.metrics[1]).toMatchObject({ id: "vo2max", tone: "good" });
  });

  it("counts done and missed sessions, key ones apart, and names the next", () => {
    const activities = [testRun({ local_date: "2026-11-17" })];
    const [p] = planProgress({ planHistory, training, activities, today: "2026-11-20" }, "2026-11-20");
    expect(p.adherence).toEqual({ due: 2, done: 1, keyDue: 1, keyDone: 0, missed: ["Thu Tempo"] });
    expect(p.next).toMatchObject({ date: "2026-11-21", name: "Long Run", key: true });
  });

  it("leaves out a plan that has ended and one that hadn't started", () => {
    const coach = [session("2026-11-10", { sport: "cycling", provider: "Garmin Coach", plan_name: "Getting into cycling", name: "Tempo" })];
    const data = { planHistory: [...planHistory, ...coach], training, activities: [], today: "2026-11-20" };
    expect(planProgress(data, "2026-11-20").map((p) => p.who)).toEqual(["Runna"]);
    expect(planProgress(data, "2026-11-12").map((p) => p.who)).toEqual(["Garmin Coach"]);
  });

  it("isn't a plan when it's only workouts made by hand in Garmin Connect", () => {
    const own = [session("2026-11-21", { provider: null, plan_name: null })];
    expect(planProgress({ planHistory: own, training, activities: [], today: "2026-11-20" }, "2026-11-20")).toEqual([]);
  });
});

describe("runRamp", () => {
  const runs = (dates: string[], miles: number) => dates.map((d) => testRun({ local_date: d, distance_m: miles * 1609.344 }));

  it("is quiet for a steady build", () => {
    const base = runs(["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"], 6);
    const r = runRamp([...base, ...runs(["2026-11-18"], 6.5)], "2026-11-20")!;
    expect(r.warn).toBe(false);
  });

  it("warns when the last week jumps well past the monthly average", () => {
    const base = runs(["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"], 5);
    const r = runRamp([...base, ...runs(["2026-11-16", "2026-11-18", "2026-11-20"], 3)], "2026-11-20")!;
    expect(r.warn).toBe(true);
    expect(r.change).toBeCloseTo(0.8);
    expect(r.text).toContain("up 80%");
  });

  it("warns on a big week from almost nothing, and is null with no running", () => {
    expect(runRamp(runs(["2026-11-16", "2026-11-18", "2026-11-20"], 3), "2026-11-20")!.warn).toBe(true);
    expect(runRamp([], "2026-11-20")).toBeNull();
  });
});
