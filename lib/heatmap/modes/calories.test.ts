import { describe, expect, it } from "vitest";
import type { NutritionDay } from "@/lib/data/nutrition-days";
import type { DashboardData, ModeContext } from "@/lib/dashboard/types";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { CALORIES_MODE, type CaloriesTooltipData } from "./calories";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
const PROGRAM_START = "2026-09-17";
const TODAY = "2026-09-20";

function day(local_date: string, over: Partial<NutritionDay> = {}): NutritionDay {
  return {
    user_id: USER,
    local_date,
    tracking_status: "accurate",
    calories_kcal: null,
    notes: null,
    updated_at: "",
    ...over,
  };
}

function data(nutritionDays: NutritionDay[]): DashboardData {
  return {
    profile: {} as DashboardData["profile"],
    activityTypes: [],
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend: [],
    injections: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, nutritionDays, activities: [], steps: [] },
    range: { window: { from: TODAY, to: TODAY }, nutritionDays: [], activities: [], steps: [] },
    dateRange: { key: "week", from: TODAY, to: TODAY },
  };
}

const ctx: ModeContext = { range: { key: "week", from: TODAY, to: TODAY }, palette: DEFAULT_PALETTE, weightSubMode: "avg7" };
const cellOn = (cells: ReturnType<typeof CALORIES_MODE.toCells>, date: string) => cells.find((c) => c.date === date);

describe("CALORIES_MODE.toCells", () => {
  it("colors accurate, uncertain and missed distinctly and marks no-row as none", () => {
    const cells = CALORIES_MODE.toCells(
      data([day("2026-09-17", { tracking_status: "accurate" }), day("2026-09-18", { tracking_status: "uncertain" }), day("2026-09-19", { tracking_status: "missed" })]),
      ctx,
    );
    expect(cellOn(cells, "2026-09-17")).toMatchObject({ fill: DEFAULT_PALETTE.good, state: "data" });
    expect(cellOn(cells, "2026-09-18")).toMatchObject({ fill: DEFAULT_PALETTE.warn, state: "data" });
    expect(cellOn(cells, "2026-09-19")).toMatchObject({ fill: DEFAULT_PALETTE.missed, state: "data" });
    expect(cellOn(cells, "2026-09-20")?.state).toBe("none");
  });

  it("carries the status, kcal and notes into the tooltip", () => {
    const cells = CALORIES_MODE.toCells(
      data([day("2026-09-17", { tracking_status: "uncertain", notes: "Dinner out, estimated" })]),
      ctx,
    );
    const tip = cellOn(cells, "2026-09-17")!.tooltip as CaloriesTooltipData;
    expect(tip).toEqual({ status: "uncertain", caloriesKcal: null, notes: "Dinner out, estimated" });
  });

  it("marks days outside the program as pre_program or future with no fill", () => {
    const cells = CALORIES_MODE.toCells(data([]), ctx);
    expect(cellOn(cells, "2026-09-13")).toMatchObject({ state: "pre_program", fill: null });
    expect(cellOn(cells, "2026-09-21")).toMatchObject({ state: "future", fill: null });
  });
});

describe("CALORIES_MODE.legend", () => {
  it("has four entries following the palette", () => {
    const items = CALORIES_MODE.legend(ctx, data([]));
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.label)).toEqual(["accurate", "may be off", "missed", "nothing logged"]);
  });
});
