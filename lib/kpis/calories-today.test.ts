import { describe, expect, it } from "vitest";
import type { TrackingStatus } from "@/lib/data/nutrition-days";
import { caloriesToday } from "./calories-today";
import { testDashboardData, TODAY, USER } from "./testing";

function nutritionRow(tracking_status: TrackingStatus, notes: string | null = null) {
  return { user_id: USER, local_date: TODAY, tracking_status, calories_kcal: null, notes, updated_at: "" };
}

describe("caloriesToday", () => {
  it("is the empty state with nothing logged today", () => {
    expect(caloriesToday.compute(testDashboardData())).toBeNull();
  });

  it("always shows a dash for the number in V0, with the status as the delta", () => {
    const data = testDashboardData({ heatmap: { window: { from: "a", to: "b" }, nutritionDays: [nutritionRow("accurate")], activities: [], steps: [] } });
    const value = caloriesToday.compute(data)!;
    expect(caloriesToday.format(value)).toEqual({ primary: "—", delta: "Accurate", tone: "good" });
  });

  it("maps uncertain to warn and missed to bad", () => {
    const uncertain = caloriesToday.compute(
      testDashboardData({ heatmap: { window: { from: "a", to: "b" }, nutritionDays: [nutritionRow("uncertain")], activities: [], steps: [] } }),
    )!;
    expect(caloriesToday.format(uncertain)).toMatchObject({ delta: "May be off", tone: "warn" });

    const missed = caloriesToday.compute(
      testDashboardData({ heatmap: { window: { from: "a", to: "b" }, nutritionDays: [nutritionRow("missed")], activities: [], steps: [] } }),
    )!;
    expect(caloriesToday.format(missed)).toMatchObject({ delta: "Missed", tone: "bad" });
  });
});
