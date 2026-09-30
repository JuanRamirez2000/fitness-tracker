import { describe, expect, it } from "vitest";
import type { DashboardData } from "@/lib/dashboard/types";
import { heatmapStats } from "./caption";

function data(over: Partial<DashboardData>): DashboardData {
  return {
    profile: {} as DashboardData["profile"],
    today: "2026-09-20",
    programStart: "2026-09-17",
    firstWeighIn: null,
    weightTrend: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" } },
    weighIns: [],
    dateRange: { key: "week", from: "2026-09-20", to: "2026-09-20" },
    ...over,
  };
}

describe("heatmapStats", () => {
  it("counts the start day itself as day 1", () => {
    expect(heatmapStats(data({ today: "2026-09-17", programStart: "2026-09-17" })).elapsed).toBe(1);
    expect(heatmapStats(data({})).elapsed).toBe(4);
  });

  it("counts weigh-ins inside the heatmap window only", () => {
    const stats = heatmapStats(
      data({
        weightTrend: [
          { user_id: "u", local_date: "2026-09-17", weight_lb: 232, avg7_lb: 232, n7: 1, raw_delta_lb: null, avg7_delta_lb: null },
          { user_id: "u", local_date: "2025-01-01", weight_lb: 232, avg7_lb: 232, n7: 1, raw_delta_lb: null, avg7_delta_lb: null },
        ],
      }),
    );
    expect(stats.weighIns).toBe(1);
  });
});
