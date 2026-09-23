import { describe, expect, it } from "vitest";
import { testDashboardData } from "@/lib/kpis/testing";
import type { Activity } from "@/lib/data/activities";
import { buildActivityWeeks } from "./activity";

function activity(local_date: string, activity_type: string): Activity {
  return {
    id: `${local_date}-${activity_type}`,
    user_id: "u",
    local_date,
    activity_type,
    duration_min: null,
    notes: null,
    source: "manual",
    external_id: null,
    created_at: "2026-09-20T00:00:00Z",
  };
}

describe("buildActivityWeeks", () => {
  it("counts a day once per activity type even with two sessions the same day", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-14" },
      activityTypes: [
        { key: "lift", label: "Lifting", color: "#7fb2ff", sort_order: 0 },
        { key: "run", label: "Run", color: "#e08a45", sort_order: 1 },
      ],
      range: {
        window: { from: "2026-09-14", to: "2026-09-14" },
        nutritionDays: [],
        steps: [],
        activities: [activity("2026-09-14", "lift"), activity("2026-09-14", "lift"), activity("2026-09-14", "run")],
      },
    });
    const weeks = buildActivityWeeks(data);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].counts).toEqual({ lift: 1, run: 1 });
  });

  it("gives a zero count for an activity type with no sessions in range", () => {
    const data = testDashboardData({
      dateRange: { key: "week", from: "2026-09-14", to: "2026-09-14" },
      activityTypes: [{ key: "swim", label: "Swim", color: "#3fb0c9", sort_order: 0 }],
    });
    expect(buildActivityWeeks(data)[0].counts).toEqual({ swim: 0 });
  });
});
