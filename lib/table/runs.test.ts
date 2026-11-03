import { describe, expect, it } from "vitest";
import { testDashboardData, testRun } from "@/lib/kpis/testing";
import { buildRunRows } from "./runs";

describe("buildRunRows", () => {
  it("lists runs in range, newest first, ready to display", () => {
    const rows = buildRunRows(
      testDashboardData({
        dateRange: { key: "custom", from: "2026-09-01", to: "2026-09-30" },
        activities: [
          testRun({ local_date: "2026-08-31" }),
          testRun({ local_date: "2026-09-05", training_effect_label: "VO2MAX", aerobic_training_effect: 4 }),
          testRun({ local_date: "2026-09-10", activity_type: "walking" }),
          testRun({ local_date: "2026-09-12" }),
        ],
      }),
    );
    expect(rows.map((r) => r.local_date)).toEqual(["2026-09-12", "2026-09-05"]);
    expect(rows[0]).toMatchObject({ kind: "easy", miles: "3.00", time: "36:00", pace: "12:00", avgHr: 130, cadence: 155, effect: "2.5 aerobic base", fastestMile: "11:40" });
    expect(rows[1]).toMatchObject({ kind: "workout", effect: "4.0 vo2max" });
  });
});
