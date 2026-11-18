import { describe, expect, it } from "vitest";
import type { MoodLog } from "@/lib/data/mood";
import type { PlannedWorkout } from "@/lib/data/planned";
import type { DailyRecovery } from "@/lib/data/recovery";
import { testDashboardData, testProfile, testRide, testRun, USER } from "@/lib/kpis/testing";
import { parseWorkoutSettings } from "@/lib/workouts/settings";
import { countdownCard, hoursBySport, loadCard, planVsDone, readinessCard, weekMood, weekRecovery } from "./build";
import { parseWeekParam, progressWeek } from "./week";

const MONDAY = "2026-11-09";
const day = (i: number) => `2026-11-${String(9 + i).padStart(2, "0")}`;

function plan(date: string, sport: string | null, over: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    workout_uuid: `${date}-${sport}`,
    local_date: date,
    sport,
    name: "Tempo",
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
    ...over,
  };
}

function recovery(date: string, readiness: number | null, over: Partial<DailyRecovery> = {}): DailyRecovery {
  return {
    user_id: USER,
    local_date: date,
    resting_hr: null,
    hrv_ms: null,
    hrv_baseline_low: null,
    hrv_baseline_high: null,
    hrv_status: null,
    body_battery_high: null,
    body_battery_low: null,
    body_battery_wake: null,
    avg_stress: null,
    readiness_score: readiness,
    readiness_level: null,
    readiness_factors: null,
    readiness_at: null,
    readiness_morning_score: null,
    recovery_hours: null,
    ...over,
  };
}

function mood(date: string, over: Partial<MoodLog> = {}): MoodLog {
  return { user_id: USER, local_date: date, mood: 4, energy: 3, soreness: 2, sore_areas: [], motivation: 4, sick: false, injured: false, updated_at: `${date}T15:00:00Z`, ...over };
}

describe("parseWeekParam", () => {
  it("snaps to the Monday, defaults to this week and stays inside the program", () => {
    expect(parseWeekParam(undefined, "2026-11-17", "2026-09-17")).toBe("2026-11-16");
    expect(parseWeekParam("2026-11-12", "2026-11-17", "2026-09-17")).toBe(MONDAY);
    expect(parseWeekParam("2026-12-01", "2026-11-17", "2026-09-17")).toBe("2026-11-16");
    expect(parseWeekParam("2026-01-05", "2026-11-17", "2026-09-17")).toBe("2026-09-14");
    expect(parseWeekParam("nope", "2026-11-17", "2026-09-17")).toBe("2026-11-16");
  });

  it("knows the current week runs only through today", () => {
    expect(progressWeek(MONDAY, day(2))).toMatchObject({ current: true, through: day(2), sunday: day(6) });
    expect(progressWeek(MONDAY, "2026-11-20")).toMatchObject({ current: false, through: day(6) });
  });
});

describe("loadCard", () => {
  it("compares the current week with the same days of last week and flags a jump", () => {
    // Last week: 40 on Monday and 40 on Thursday. This week through Tuesday: 40 + 40.
    const activities = [testRun({ local_date: "2026-11-02" }), testRun({ local_date: "2026-11-05" }), testRun({ local_date: day(0) }), testRide({ local_date: day(1), training_load: 40 })];
    const card = loadCard(activities, progressWeek(MONDAY, day(1)));
    expect(card.value).toBe(80);
    expect(card.delta).toBe(100);
    expect(card.tone).toBe("warn");
    expect(card.sub).toContain("vs 40 last week through Tue");
  });

  it("compares a finished week with the whole week before", () => {
    const activities = [testRun({ local_date: "2026-11-02" }), testRun({ local_date: "2026-11-05" }), testRun({ local_date: day(3) })];
    const card = loadCard(activities, progressWeek(MONDAY, "2026-11-20"));
    expect(card).toMatchObject({ value: 40, delta: -50, tone: "neutral" });
    expect(card.sub).toBe("vs 80 last week");
  });
});

describe("readinessCard", () => {
  it("averages the week's readiness against the week before, with the mood log", () => {
    const data = {
      recovery: [recovery("2026-11-03", 50), recovery(day(0), 70), recovery(day(1), 80, { readiness_morning_score: 90 })],
      moodLogs: [mood(day(0)), mood(day(1), { mood: 3, sick: true })],
    };
    const card = readinessCard(data, progressWeek(MONDAY, day(2)))!;
    expect(card).toMatchObject({ value: 80, delta: 30, tone: "good" });
    expect(card.sub).toBe("mood 3.5 of 5 (2 of 3 days logged) · sick 1 day");
    expect(readinessCard({ recovery: [], moodLogs: [] }, progressWeek(MONDAY, day(2)))).toBeNull();
  });
});

describe("countdownCard", () => {
  it("counts whole weeks to the race from the week's last day so far", () => {
    const profile = testProfile({ workout_settings: parseWorkoutSettings({ race: { name: "Sprint", date: "2027-04-11" } }) });
    const card = countdownCard({ profile }, progressWeek(MONDAY, day(2)))!;
    expect(card.value).toBe(21);
    expect(card.deltaText).toBe("Base");
    expect(countdownCard({ profile: testProfile({ workout_settings: parseWorkoutSettings({ race: null }) }) }, progressWeek(MONDAY, day(2)))).toBeNull();
  });
});

describe("hoursBySport", () => {
  it("stacks Monday weeks by sport from the first active week, against the band", () => {
    const activities = [testRide({ local_date: "2026-10-27" }), testRun({ local_date: "2026-11-01" }), testRide({ local_date: day(0), duration_s: 5 * 3600, moving_duration_s: 5 * 3600 })];
    const h = hoursBySport({ activities, profile: testProfile(), today: "2026-11-20" }, progressWeek(MONDAY, "2026-11-20"))!;
    expect(h.weeks.map((w) => w.monday)).toEqual(["2026-10-26", "2026-11-02", MONDAY]);
    expect(h.weeks[0].hours).toMatchObject({ ride: 1, run: 0.6 });
    expect(h.selected.total).toBe(5);
    expect(h.band).toEqual({ min: 4, max: 7 });
    expect(h.inBand).toBe(1);
    expect(h.sports).toEqual(["ride", "run"]);
  });
});

describe("planVsDone", () => {
  it("marks each planned session done, moved, swapped, missed or still to come", () => {
    const planned = [
      plan(day(0), "cycling"), // ridden that day: done
      plan(day(1), "cycling"), // ridden on Wednesday instead: moved
      plan(day(3), "cycling"), // ran instead: swapped
      plan(day(4), "cycling"), // nothing: missed
      plan(day(5), null, { rest_day: true, duration_s: null }),
      plan(day(6), "run", { source: "self" }), // today, not done yet
    ];
    const activities = [testRide({ local_date: day(0) }), testRide({ local_date: day(2) }), testRun({ local_date: day(3) }), testRun({ local_date: day(5) })];
    const p = planVsDone({ activities, planned, today: day(6) }, progressWeek(MONDAY, day(6)));
    expect(p.days.map((d) => d.planned.map((i) => i.status))).toEqual([["done"], ["moved"], [], ["swapped"], ["missed"], [], ["today"]]);
    expect(p.days[2].movedIn[0].from).toBe(day(1));
    expect(p.days[5]).toMatchObject({ restDay: true, extras: [{ local_date: day(5) }] });
    expect(p).toMatchObject({ hasPlan: true, due: 4, done: 2, swapped: 1, missed: 1, extras: 1, plannedMinutes: 300 });
  });

  it("calls a planned day off a rest day only when nothing else is planned", () => {
    const p = planVsDone({ activities: [], planned: [plan(day(2), null, { rest_day: true })], today: day(0) }, progressWeek(MONDAY, day(0)));
    expect(p.days[2].restDay).toBe(true);
    expect(p.hasPlan).toBe(false);
  });
});

describe("weekRecovery and weekMood", () => {
  it("lines the week's mornings and logs up by day", () => {
    const data = testDashboardData({
      today: day(1),
      recovery: [recovery(day(0), 60, { hrv_status: "BALANCED" }), recovery(day(1), 40, { hrv_status: "UNBALANCED" })],
      moodLogs: [mood(day(1))],
    });
    const week = progressWeek(MONDAY, day(1));
    const r = weekRecovery(data, week)!;
    expect(r).toMatchObject({ avgReadiness: 50, hrvDays: 2, balanced: 1 });
    expect(r.days[2].future).toBe(true);
    const m = weekMood(data, week);
    expect(m).toMatchObject({ logged: 1, span: 2, avgMood: 4 });
  });
});
