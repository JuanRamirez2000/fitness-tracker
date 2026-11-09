import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun } from "@/lib/kpis/testing";
import type { ModeContext } from "@/lib/dashboard/types";
import { paletteFor } from "@/lib/theme/palette";
import { TRAINING_MODE, trainingFill, type TrainingTooltipData } from "./training";

const ctx = (sport: ModeContext["sport"]): ModeContext => ({
  range: { key: "week", from: "2026-09-14", to: "2026-09-20" },
  palette: paletteFor("dark"),
  weightSubMode: "avg7",
  sport,
});
const day = "2026-09-18";
const activities = [testRun({ local_date: day }), testRide({ local_date: day }), testRun({ local_date: day, activity_type: "walking", id: "00000000-0000-4000-8000-000000000001" })];

describe("TRAINING_MODE", () => {
  it("under Run, fills a run day by its miles and ignores rides and walks", () => {
    const cells = TRAINING_MODE.toCells(testDashboardData({ sport: "run", activities }), ctx("run"));
    const runDay = cells.find((c) => c.date === day)!;
    const restDay = cells.find((c) => c.date === "2026-09-19")!;
    expect(runDay.fill).toBe(trainingFill(3, "run", ctx("run").palette));
    expect((runDay.tooltip as TrainingTooltipData).items).toEqual([
      { name: "Test Run", sport: "run", miles: expect.closeTo(3), minutes: 36, speed: "12:00/mi", avgHr: 130 },
    ]);
    expect(restDay).toMatchObject({ state: "data", fill: trainingFill(0, "run", ctx("run").palette), tooltip: { items: [] } });
  });

  it("under Ride, fills by ride miles and shows speed in mph", () => {
    const cells = TRAINING_MODE.toCells(testDashboardData({ sport: "ride", activities }), ctx("ride"));
    const rideDay = cells.find((c) => c.date === day)!;
    expect(rideDay.fill).toBe(trainingFill(15, "ride", ctx("ride").palette));
    expect((rideDay.tooltip as TrainingTooltipData).items).toEqual([
      { name: "Test Ride", sport: "ride", miles: expect.closeTo(15), minutes: 60, speed: "15.0 mph", avgHr: 135 },
    ]);
  });

  it("under All, fills by minutes of rides and runs together", () => {
    const cells = TRAINING_MODE.toCells(testDashboardData({ sport: "all", activities }), ctx("all"));
    const both = cells.find((c) => c.date === day)!;
    expect((both.tooltip as TrainingTooltipData).items.map((i) => i.sport)).toEqual(["run", "ride"]);
    expect(both.fill).toBe(trainingFill(96, "all", ctx("all").palette));
  });

  it("labels the legend in the sport's unit", () => {
    expect(TRAINING_MODE.legend(ctx("ride")).map((l) => l.label)).toEqual(["rest", "12.5 mi", "25+ mi", "future"]);
    expect(TRAINING_MODE.legend(ctx("all")).map((l) => l.label)).toEqual(["rest", "45 min", "90+ min", "future"]);
  });

  it("leaves days before the program and after today to the shared date states", () => {
    const cells = TRAINING_MODE.toCells(testDashboardData({ activities: [testRun({ local_date: "2026-09-14" })] }), ctx("run"));
    expect(cells.find((c) => c.date === "2026-09-14")!.state).toBe("pre_program");
    expect(cells.find((c) => c.date === "2026-09-21")!.state).toBe("future");
  });
});
