import { describe, expect, it } from "vitest";
import { stepsToday } from "./steps-today";
import { testDashboardData, testProfile, TODAY, USER } from "./testing";

function stepsRow(value: number) {
  return { user_id: USER, local_date: TODAY, metric: "steps", value, source: "manual" as const, updated_at: "" };
}

describe("stepsToday", () => {
  it("is the empty state with nothing logged today", () => {
    expect(stepsToday.compute(testDashboardData())).toBeNull();
  });

  it("keeps a recorded zero distinct from no data", () => {
    const data = testDashboardData({ heatmap: { window: { from: "a", to: "b" }, nutritionDays: [], activities: [], steps: [stepsRow(0)] } });
    const value = stepsToday.compute(data)!;
    expect(value).not.toBeNull();
    expect(value.tone).toBe("neutral");
    expect(value.progress).toBe(0);
  });

  it("marks the goal hit and formats to thousands with one decimal", () => {
    const data = testDashboardData({
      profile: testProfile({ steps_goal: 10000 }),
      heatmap: { window: { from: "a", to: "b" }, nutritionDays: [], activities: [], steps: [stepsRow(13400)] },
    });
    const value = stepsToday.compute(data)!;
    expect(value.tone).toBe("good");
    expect(value.progress).toBe(1); // clamped, even though 13400 > goal
    expect(stepsToday.format(value)).toEqual({ primary: "13.4k", delta: "10k hit", tone: "good" });
  });

  it("shows 'under' below the goal, with a partial progress fraction", () => {
    const data = testDashboardData({
      profile: testProfile({ steps_goal: 8000 }),
      heatmap: { window: { from: "a", to: "b" }, nutritionDays: [], activities: [], steps: [stepsRow(4000)] },
    });
    const value = stepsToday.compute(data)!;
    expect(value.progress).toBe(0.5);
    expect(stepsToday.format(value).delta).toBe("under");
  });
});
