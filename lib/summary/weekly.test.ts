import { describe, expect, it } from "vitest";
import type { MoodLog } from "@/lib/data/mood";
import type { PlannedWorkout } from "@/lib/data/planned";
import type { DailyRecovery } from "@/lib/data/recovery";
import { testProfile, testRide, testRun, USER } from "@/lib/kpis/testing";
import { progressWeek } from "@/lib/progress/week";
import { hasEnoughForWeekly, parseWeeklyAnswer, weeklyFacts, weeklyTarget, type WeeklyInput } from "./weekly";

const MONDAY = "2026-11-09";
const day = (i: number) => `2026-11-${String(9 + i).padStart(2, "0")}`;

const plan = (date: string, name: string, over: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  workout_uuid: `${date}-${name}`,
  local_date: date,
  sport: "cycling",
  name,
  description: null,
  duration_s: 3600,
  benefit: null,
  rest_day: false,
  key_workout: true,
  status: null,
  plan_name: "Getting into cycling",
  source: "garmin",
  settings: null,
  steps: null,
  push_status: null,
  push_error: null,
  pushed_at: null,
  provider: null,
  duration_estimated: false,
  ...over,
});

const morning = (date: string, readiness: number) =>
  ({ user_id: USER, local_date: date, readiness_score: readiness, readiness_morning_score: null, hrv_status: "BALANCED", body_battery_wake: null, hrv_ms: 48 }) as unknown as DailyRecovery;

const mood = (date: string, over: Partial<MoodLog> = {}): MoodLog => ({
  user_id: USER, local_date: date, mood: 4, energy: 2, soreness: 3, sore_areas: ["legs"], motivation: 4, sick: false, injured: false, updated_at: `${date}T15:00:00Z`, ...over,
});

function input(over: Partial<WeeklyInput> = {}): WeeklyInput {
  const today = over.today ?? day(2);
  return {
    week: progressWeek(MONDAY, today),
    final: false,
    today,
    profile: testProfile(),
    activities: [testRide({ local_date: day(0), name: "Tempo", started_at: `${day(0)}T14:00:00Z` }), testRun({ local_date: day(0), started_at: `${day(0)}T15:05:00Z` })],
    recovery: [morning("2026-11-03", 60), morning(day(0), 45), morning(day(1), 70)],
    sleep: [],
    moodLogs: [mood(day(1), { sick: true })],
    planned: [plan(day(0), "Tempo"), plan(day(1), "Anaerobic"), plan(day(4), "Long Ride"), plan(day(9), "Base")],
    ...over,
  };
}

describe("weeklyTarget", () => {
  it("writes last week's final review on Monday, this week's so far otherwise", () => {
    expect(weeklyTarget("2026-11-16")).toEqual({ monday: MONDAY, final: true });
    expect(weeklyTarget("2026-11-18")).toEqual({ monday: "2026-11-16", final: false });
    expect(weeklyTarget("2026-11-22")).toEqual({ monday: "2026-11-16", final: false });
  });
});

describe("weeklyFacts", () => {
  it("covers the week so far in words, with what's left this week", () => {
    const facts = weeklyFacts(input()) as Record<string, Record<string, unknown>>;
    expect(facts.week.status).toBe("so far, through Wednesday");
    expect(facts.training).toMatchObject({ hours: 1.6, weekly_hours_aim: "4 to 7", bricks_run_straight_off_a_ride: 1 });
    expect(facts.training.sessions).toHaveLength(2);
    expect(facts.plan).toMatchObject({ sessions_due: 2, done: 1, missed: ["Tuesday Anaerobic"] });
    expect(facts.recovery).toMatchObject({ average_training_readiness: 58, average_readiness_the_week_before: 60, lowest_readiness: "45 on Monday", hrv_status_balanced_days: "2 of 2" });
    expect(JSON.stringify(facts)).not.toContain("48");
    expect(facts.how_they_felt).toMatchObject({ days_logged: "1 of 3", average_energy: "Tired (2 of 5)", sick_days: ["Tuesday"], sore_areas: ["legs"] });
    expect(facts.race).toMatchObject({ weeks_to_go: 21, training_phase: "Base" });
    expect(facts.rest_of_week_planned).toEqual([{ day: "Friday", what: "Long Ride", minutes: 60, from: "Garmin Coach", key_session: true }]);
    expect(hasEnoughForWeekly(facts)).toBe(true);
  });

  it("previews the week ahead once the week is finished", () => {
    const facts = weeklyFacts(input({ today: "2026-11-16", week: progressWeek(MONDAY, "2026-11-16"), final: true }));
    expect((facts.week as { status: string }).status).toBe("finished");
    expect(facts.next_week_planned).toEqual([expect.objectContaining({ day: "Wednesday", what: "Base" })]);
    expect(facts).not.toHaveProperty("rest_of_week_planned");
  });

  it("has nothing to review in an empty week", () => {
    const facts = weeklyFacts(input({ activities: [], recovery: [], moodLogs: [], planned: [] }));
    expect(hasEnoughForWeekly(facts)).toBe(false);
  });
});

describe("parseWeeklyAnswer", () => {
  it("keeps the headline and at most two items per section", () => {
    const answer = parseWeeklyAnswer(JSON.stringify({ headline: " A solid start. ", wins: ["a", "b", "c"], watch: [" x "], next: ["n"] }));
    expect(answer).toEqual({ headline: "A solid start.", sections: { wins: ["a", "b"], watch: ["x"], next: ["n"] } });
    expect(parseWeeklyAnswer("not json")).toBeNull();
    expect(parseWeeklyAnswer(JSON.stringify({ headline: "", wins: [], watch: [], next: [] }))).toBeNull();
  });
});
