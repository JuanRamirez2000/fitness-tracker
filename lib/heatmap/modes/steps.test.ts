import { describe, expect, it } from "vitest";
import type { DailyMetric } from "@/lib/data/daily-metrics";
import type { DashboardData, ModeContext } from "@/lib/dashboard/types";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { STEPS_MODE, type StepsTooltipData } from "./steps";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
const PROGRAM_START = "2026-09-17";
const TODAY = "2026-09-20";

function metric(local_date: string, value: number): DailyMetric {
  return { user_id: USER, local_date, metric: "steps", value, source: "manual", updated_at: "" };
}

function data(steps: DailyMetric[], stepsGoal = 10000): DashboardData {
  return {
    profile: { steps_goal: stepsGoal } as DashboardData["profile"],
    activityTypes: [],
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend: [],
    injections: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, nutritionDays: [], activities: [], steps },
    range: { window: { from: TODAY, to: TODAY }, nutritionDays: [], activities: [], steps: [] },
    dateRange: { key: "week", from: TODAY, to: TODAY },
  };
}

const ctx: ModeContext = { range: { key: "week", from: TODAY, to: TODAY }, palette: DEFAULT_PALETTE, weightSubMode: "avg7" };
const cellOn = (cells: ReturnType<typeof STEPS_MODE.toCells>, date: string) => cells.find((c) => c.date === date);

describe("STEPS_MODE.toCells", () => {
  it("is full intensity at the goal and none without a row", () => {
    const cells = STEPS_MODE.toCells(data([metric("2026-09-17", 10000)]), ctx);
    expect(cellOn(cells, "2026-09-17")).toMatchObject({ fill: DEFAULT_PALETTE.accent, state: "data" });
    expect(cellOn(cells, "2026-09-18")?.state).toBe("none");
  });

  it("keeps a recorded zero distinct from no row at all", () => {
    const cells = STEPS_MODE.toCells(data([metric("2026-09-17", 0)]), ctx);
    expect(cellOn(cells, "2026-09-17")?.state).toBe("data");
    expect(cellOn(cells, "2026-09-17")?.fill).not.toBeNull();
  });

  it("carries the count, goal and hit flag into the tooltip", () => {
    const cells = STEPS_MODE.toCells(data([metric("2026-09-17", 7000)], 8000), ctx);
    expect(cellOn(cells, "2026-09-17")!.tooltip as StepsTooltipData).toEqual({ steps: 7000, goal: 8000, hit: false });
  });

  it("marks days outside the program as pre_program or future with no fill", () => {
    const cells = STEPS_MODE.toCells(data([]), ctx);
    expect(cellOn(cells, "2026-09-13")).toMatchObject({ state: "pre_program", fill: null });
    expect(cellOn(cells, "2026-09-21")).toMatchObject({ state: "future", fill: null });
  });
});

describe("STEPS_MODE.legend", () => {
  it("has four stops ending at the accent color", () => {
    const items = STEPS_MODE.legend(ctx, data([]));
    expect(items).toHaveLength(4);
    expect(items[items.length - 1].swatch).toBe(DEFAULT_PALETTE.accent);
  });
});
