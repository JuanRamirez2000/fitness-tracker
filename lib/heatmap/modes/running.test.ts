import { describe, expect, it } from "vitest";
import { testDashboardData, testRun } from "@/lib/kpis/testing";
import { paletteFor } from "@/lib/theme/palette";
import { RUNNING_MODE, runningFill, type RunningTooltipData } from "./running";

const ctx = { range: { key: "week" as const, from: "2026-09-14", to: "2026-09-20" }, palette: paletteFor("dark"), weightSubMode: "avg7" as const };

describe("RUNNING_MODE", () => {
  it("fills a run day by its miles and a rest day with the floor", () => {
    const cells = RUNNING_MODE.toCells(
      testDashboardData({ activities: [testRun({ local_date: "2026-09-18" }), testRun({ local_date: "2026-09-18", activity_type: "cycling", id: "00000000-0000-4000-8000-000000000001" })] }),
      ctx,
    );
    const runDay = cells.find((c) => c.date === "2026-09-18")!;
    const restDay = cells.find((c) => c.date === "2026-09-19")!;
    expect(runDay.fill).toBe(runningFill(3, ctx.palette));
    expect((runDay.tooltip as RunningTooltipData).runs).toEqual([{ name: "Test Run", miles: expect.closeTo(3), pace: "12:00", avgHr: 130 }]);
    expect(restDay).toMatchObject({ state: "data", fill: runningFill(0, ctx.palette), tooltip: { runs: [] } });
  });

  it("leaves days before the program and after today to the shared date states", () => {
    const cells = RUNNING_MODE.toCells(testDashboardData({ activities: [testRun({ local_date: "2026-09-14" })] }), ctx);
    expect(cells.find((c) => c.date === "2026-09-14")!.state).toBe("pre_program");
    expect(cells.find((c) => c.date === "2026-09-21")!.state).toBe("future");
  });
});
