import { describe, expect, it } from "vitest";
import type { DailyMetric } from "@/lib/data/daily-metrics";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import type { DashboardData, ModeContext } from "@/lib/dashboard/types";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { LOGGED_MODE, type LoggedTooltipData } from "./logged";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
const PROGRAM_START = "2026-09-17";
const TODAY = "2026-09-20";

function weighIn(local_date: string): WeightTrendRow {
  return { user_id: USER, local_date, weight_lb: 200, avg7_lb: 200, n7: 1, raw_delta_lb: null, avg7_delta_lb: null };
}
function metric(local_date: string, value: number): DailyMetric {
  return { user_id: USER, local_date, metric: "steps", value, source: "manual", updated_at: "" };
}

function data(weightTrend: WeightTrendRow[], steps: DailyMetric[]): DashboardData {
  return {
    profile: { steps_goal: 10000 } as DashboardData["profile"],
    activityTypes: [],
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend,
    injections: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, nutritionDays: [], activities: [], steps },
    range: { window: { from: TODAY, to: TODAY }, nutritionDays: [], activities: [], steps: [] },
    dateRange: { key: "week", from: TODAY, to: TODAY },
  };
}

const ctx: ModeContext = { range: { key: "week", from: TODAY, to: TODAY }, palette: DEFAULT_PALETTE, weightSubMode: "avg7" };
const cellOn = (cells: ReturnType<typeof LOGGED_MODE.toCells>, date: string) => cells.find((c) => c.date === date);

describe("LOGGED_MODE.toCells", () => {
  it("shows four distinct states", () => {
    const cells = LOGGED_MODE.toCells(
      data(
        [weighIn("2026-09-18"), weighIn("2026-09-19")],
        [metric("2026-09-17", 12000), metric("2026-09-19", 12000)],
      ),
      ctx,
    );
    const none = cellOn(cells, "2026-09-20")!; // in-program (Sep 17+), nothing logged
    const stepsOnly = cellOn(cells, "2026-09-17")!;
    const weightOnly = cellOn(cells, "2026-09-18")!;
    const both = cellOn(cells, "2026-09-19")!;

    const fills = [none, stepsOnly, weightOnly, both].map((c) => c.fill);
    expect(new Set(fills).size).toBe(4); // four distinct fills
    expect(none.state).toBe("none");
    expect(stepsOnly.state).toBe("data");
    expect(weightOnly.state).toBe("data");
    expect(both.state).toBe("data");
    expect(both.fill).toBe(DEFAULT_PALETTE.accent);
    expect(both.notch).toBe(true);
    expect(stepsOnly.notch).toBeUndefined();
    expect(weightOnly.notch).toBeUndefined();
  });

  it("carries weight/steps facts into the tooltip", () => {
    const cells = LOGGED_MODE.toCells(data([weighIn("2026-09-18")], [metric("2026-09-18", 4000)]), ctx);
    expect(cellOn(cells, "2026-09-18")!.tooltip as LoggedTooltipData).toEqual({
      weightLogged: true,
      steps: 4000,
      stepsHit: false,
      goal: 10000,
    });
  });

  it("marks days outside the program as pre_program or future with no fill", () => {
    const cells = LOGGED_MODE.toCells(data([], []), ctx);
    expect(cellOn(cells, "2026-09-13")).toMatchObject({ state: "pre_program", fill: null });
    expect(cellOn(cells, "2026-09-21")).toMatchObject({ state: "future", fill: null });
  });
});

describe("LOGGED_MODE.legend", () => {
  it("has four entries, weight-only stronger than steps-only", () => {
    const items = LOGGED_MODE.legend(ctx, data([], []));
    expect(items.map((i) => i.label)).toEqual(["nothing", "steps only", "weight logged", "weight + steps"]);
  });
});
