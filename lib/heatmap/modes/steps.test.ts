import { describe, expect, it } from "vitest";
import type { DailySteps } from "@/lib/data/steps";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { testDashboardData } from "@/lib/kpis/testing";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import type { ModeContext } from "@/lib/dashboard/types";
import { STEPS_MODE, stepsFill } from "./steps";

const ctx: ModeContext = { range: { key: "week", from: "2026-09-17", to: "2026-09-20" }, palette: DEFAULT_PALETTE, weightSubMode: "avg7" };

function stepRow(local_date: string, steps: number): DailySteps {
  return { user_id: "u", local_date, steps, source: "garmin", updated_at: "" };
}

describe("STEPS_MODE.toCells", () => {
  const data = testDashboardData({
    heatmap: { window: { from: "2026-09-13", to: "2026-09-26" }, steps: [stepRow("2026-09-18", 12000), stepRow("2026-09-19", 5000)] },
  });
  const cells = new Map(STEPS_MODE.toCells(data, ctx).map((c) => [c.date, c]));

  it("shades a day by its steps, saturating at the 10k goal", () => {
    expect(cells.get("2026-09-18")).toMatchObject({ state: "data", fill: stepsFill(10000, DEFAULT_PALETTE), tooltip: { steps: 12000, hit: true } });
    expect(cells.get("2026-09-19")).toMatchObject({ state: "data", fill: stepsFill(5000, DEFAULT_PALETTE), tooltip: { hit: false } });
  });

  it("marks an in-program day without a row as no data, and keeps pre-program and future states", () => {
    expect(cells.get("2026-09-17")).toMatchObject({ state: "none", fill: CELL_NO_DATA });
    expect(cells.get("2026-09-16")!.state).toBe("pre_program");
    expect(cells.get("2026-09-21")!.state).toBe("future");
  });

  it("reaches the accent exactly at the goal", () => {
    expect(stepsFill(10000, DEFAULT_PALETTE)).toBe(stepsFill(25000, DEFAULT_PALETTE));
    expect(stepsFill(0, DEFAULT_PALETTE)).not.toBe(stepsFill(9999, DEFAULT_PALETTE));
  });
});
