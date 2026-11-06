import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates/calendar";
import { TODAY, testDashboardData, testProfile, trendRow } from "@/lib/kpis/testing";
import { buildGoalProjection, buildWeeklyLoss, currentPace } from "./weight-plan";

/** One weigh-in a day for `days` days ending today, the average falling `perDay` lb a day to `end`. */
function steady(days: number, end: number, perDay: number) {
  return Array.from({ length: days }, (_, i) => {
    const w = end + (days - 1 - i) * perDay;
    return trendRow({ local_date: addDays(TODAY, -(days - 1 - i)), weight_lb: w, avg7_lb: w });
  });
}

describe("currentPace", () => {
  it("fits lb a week over the last 4 weeks", () => {
    expect(currentPace(steady(40, 250, 0.1), TODAY)).toBeCloseTo(0.7);
  });

  it("isn't thrown by one heavy weigh-in at the end", () => {
    const rows = steady(28, 250, 0.1);
    rows[rows.length - 1] = { ...rows[rows.length - 1], avg7_lb: 253 };
    expect(currentPace(rows, TODAY)!).toBeGreaterThan(0.4);
  });

  it("is negative when gaining, and null with too few averages", () => {
    expect(currentPace(steady(28, 250, -0.05), TODAY)).toBeCloseTo(-0.35);
    expect(currentPace(steady(5, 250, 0.1), TODAY)).toBeNull();
  });
});

describe("buildGoalProjection", () => {
  const profile = testProfile({ goal_weight_lb: 200, goal_pace_lb_per_week: 1, start_weight_lb: 280 });

  it("dates the goal at the current pace and at the plan's", () => {
    const p = buildGoalProjection(testDashboardData({ profile, weightTrend: steady(40, 250, 0.1), programStart: addDays(TODAY, -70) }))!;
    expect(p.leftToGoal).toBe(50);
    expect(p.pace).toBeCloseTo(0.7);
    expect(p.eta).toBe(addDays(TODAY, Math.ceil((50 / p.pace!) * 7))); // about 71 weeks out
    // The plan: 80 lb at 1 lb a week from the start; 10 weeks in it says 270, so 20 lb ahead.
    expect(p.plan).toMatchObject({ pace: 1, goalDate: addDays(addDays(TODAY, -70), 560), target: 270, ahead: 20, etaFromNow: addDays(TODAY, 350) });
  });

  it("projects no date when the weight isn't coming down", () => {
    const p = buildGoalProjection(testDashboardData({ profile, weightTrend: steady(30, 250, -0.02) }))!;
    expect(p.eta).toBeNull();
  });

  it("projects no date further out than 3 years", () => {
    const p = buildGoalProjection(testDashboardData({ profile, weightTrend: steady(30, 250, 0.01) }))!;
    expect(p.pace).toBeCloseTo(0.07);
    expect(p.eta).toBeNull();
  });

  it("needs a goal", () => {
    expect(buildGoalProjection(testDashboardData({ weightTrend: steady(30, 250, 0.1) }))).toBeNull();
  });
});

describe("buildWeeklyLoss", () => {
  it("measures each week's drop in the 7-day average against the plan, at least 8 weeks back", () => {
    const data = testDashboardData({
      profile: testProfile({ goal_pace_lb_per_week: 1 }),
      weightTrend: steady(70, 250, 0.1),
      dateRange: { key: "week", from: addDays(TODAY, -6), to: TODAY },
    });
    const w = buildWeeklyLoss(data)!;
    expect(w.weeks.length).toBeGreaterThanOrEqual(8);
    const full = w.weeks.filter((x) => !x.partial);
    for (const week of full) expect(week.lost).toBeCloseTo(0.7);
    expect(w).toMatchObject({ pace: 1, onPlan: 0, complete: full.length });
    expect(w.avgLost).toBeCloseTo(0.7);
  });

  it("marks the week still under way", () => {
    // TODAY (2026-09-20) is a Sunday: its week has one day so far.
    const w = buildWeeklyLoss(testDashboardData({ weightTrend: steady(70, 250, 0.1) }))!;
    expect(w.weeks.at(-1)).toMatchObject({ label: TODAY, partial: true });
  });

  it("leaves out weeks measured from an average still warming up", () => {
    const rows = steady(21, 250, 0.1).map((r, i) => ({ ...r, n7: Math.min(7, i + 1), avg7_lb: i < 2 ? r.avg7_lb - 5 : r.avg7_lb }));
    const w = buildWeeklyLoss(testDashboardData({ weightTrend: rows }))!;
    expect(w.weeks.every((x) => x.lost > 0 && x.lost < 1)).toBe(true);
  });

  it("leaves out a week with no weigh-in near its end", () => {
    // No weigh-ins from 27 to 14 days ago: a week ending 21 to 14 days ago has none within 6 days of its end.
    const rows = steady(70, 250, 0.1).filter((r) => r.local_date < addDays(TODAY, -27) || r.local_date > addDays(TODAY, -14));
    const w = buildWeeklyLoss(testDashboardData({ weightTrend: rows }))!;
    expect(w.weeks.some((x) => x.end >= addDays(TODAY, -21) && x.end <= addDays(TODAY, -14))).toBe(false);
    expect(w.weeks.length).toBeGreaterThan(4);
  });
});
