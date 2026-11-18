import { describe, expect, it } from "vitest";
import type { PlannedWorkout } from "@/lib/data/planned";
import { testDashboardData, testRun, testTraining } from "@/lib/kpis/testing";
import { quickLook } from "./quick-look";

const session = (date: string, over: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  workout_uuid: `${date}-${over.name ?? "run"}`, local_date: date, sport: "running", name: "Easy Run", description: "10k Plan (Week 1/12)\n\n3mi easy",
  duration_s: 2340, benefit: null, rest_day: false, key_workout: false, status: null, plan_name: "10k Plan", source: "garmin", settings: null,
  steps: null, push_status: null, push_error: null, pushed_at: null, provider: "Runna", duration_estimated: true, ...over,
});

describe("quickLook", () => {
  const today = "2026-11-18";
  const planHistory = [session("2026-11-18"), session("2026-11-20", { name: "Tempo", key_workout: true })];
  const training = [testTraining({ local_date: "2026-11-16", race_10k_s: 3824 }), testTraining({ local_date: "2026-11-18", race_10k_s: 3800 })];

  it("leads with the next session, then the plan's goal and the week", () => {
    const cards = quickLook(testDashboardData({ today, planHistory, training }));
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey.next).toMatchObject({ label: "Next · today", value: "Easy Run", sub: "~39 min · Runna", target: "next" });
    expect(byKey["plan:Runna|10k Plan|run"]).toMatchObject({ label: "Runna · week 1/12", value: "1:03:20", wide: true, tone: "good" });
    expect(byKey.week).toMatchObject({ label: "This week", value: "0.0 h" });
  });

  it("moves on from today's session once that sport is done today", () => {
    const cards = quickLook(testDashboardData({ today, planHistory, training, activities: [testRun({ local_date: today })] }));
    expect(cards.find((c) => c.key === "next")).toMatchObject({ label: "Next · Fri", value: "Tempo", sub: "~39 min · Runna · key" });
  });
});
