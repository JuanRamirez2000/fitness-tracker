import { describe, expect, it } from "vitest";
import { testDashboardData } from "@/lib/kpis/testing";
import type { NutritionDay } from "@/lib/data/nutrition-days";
import { buildCaloriesWeeks, CALORIES_LEGEND } from "./calories";

function nutritionDay(local_date: string, tracking_status: NutritionDay["tracking_status"]): NutritionDay {
  return { user_id: "u", local_date, tracking_status, calories_kcal: null, notes: null, updated_at: "2026-09-20T00:00:00Z" };
}

describe("buildCaloriesWeeks", () => {
  it("counts each status within its calendar week, leaving unlogged days uncounted", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-16" }, // Mon-Wed
      range: {
        window: { from: "2026-09-14", to: "2026-09-16" },
        activities: [],
        steps: [],
        nutritionDays: [nutritionDay("2026-09-14", "accurate"), nutritionDay("2026-09-15", "missed")],
      },
    });
    const weeks = buildCaloriesWeeks(data);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].counts).toEqual({ accurate: 1, uncertain: 0, missed: 1 });
  });

  it("exposes a 3-item legend with a real color per status", () => {
    expect(CALORIES_LEGEND).toHaveLength(3);
    expect(CALORIES_LEGEND.map((l) => l.status)).toEqual(["accurate", "uncertain", "missed"]);
    for (const item of CALORIES_LEGEND) expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
