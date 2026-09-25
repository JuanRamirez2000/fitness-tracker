import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/data/activities";
import type { ActivityType } from "@/lib/data/activity-types";
import type { DailyMetric } from "@/lib/data/daily-metrics";
import type { DashboardData, ModeContext } from "@/lib/dashboard/types";
import { CELL_NO_DATA } from "@/lib/heatmap/colors";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { ACTIVITY_MODE, type ActivityTooltipData } from "./activity";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
const PROGRAM_START = "2026-09-17";
const TODAY = "2026-09-20";
const STEPS_GOAL = 10_000;

const TYPES: ActivityType[] = [
  { key: "run", label: "Run", color: "#F97316", sort_order: 1 },
  { key: "lift", label: "Lifting", color: "#A855F7", sort_order: 2 },
  { key: "walk", label: "Walk", color: "#14B8A6", sort_order: 3 },
];

function activity(local_date: string, over: Partial<Activity> = {}): Activity {
  return {
    id: crypto.randomUUID(),
    user_id: USER,
    local_date,
    activity_type: "run",
    duration_min: null,
    notes: null,
    source: "manual",
    external_id: null,
    created_at: "",
    ...over,
  };
}

function stepsRow(local_date: string, value: number): DailyMetric {
  return { user_id: USER, local_date, metric: "steps", value, source: "manual", updated_at: "" };
}

function data(activities: Activity[], steps: DailyMetric[] = [], activityTypes = TYPES): DashboardData {
  return {
    profile: { steps_goal: STEPS_GOAL } as DashboardData["profile"],
    activityTypes,
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend: [],
    injections: [],
    heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, nutritionDays: [], activities, steps },
    range: { window: { from: TODAY, to: TODAY }, nutritionDays: [], activities: [], steps: [] },
    dateRange: { key: "week", from: TODAY, to: TODAY },
  };
}

const ctx: ModeContext = { range: { key: "week", from: TODAY, to: TODAY }, palette: DEFAULT_PALETTE, weightSubMode: "avg7" };
const cellOn = (cells: ReturnType<typeof ACTIVITY_MODE.toCells>, date: string) => cells.find((c) => c.date === date);

describe("ACTIVITY_MODE.toCells", () => {
  it("uses the single activity's own color and marks no-activity days as none", () => {
    const cells = ACTIVITY_MODE.toCells(data([activity("2026-09-17", { activity_type: "run" })]), ctx);
    expect(cellOn(cells, "2026-09-17")).toMatchObject({ fill: "#F97316", secondFill: undefined, notch: undefined, state: "data" });
    expect(cellOn(cells, "2026-09-18")?.state).toBe("none");
  });

  it("splits and notches a day with two or more activities", () => {
    const cells = ACTIVITY_MODE.toCells(
      data([activity("2026-09-17", { activity_type: "run" }), activity("2026-09-17", { activity_type: "lift" })]),
      ctx,
    );
    const cell = cellOn(cells, "2026-09-17")!;
    expect(cell.fill).toBe("#F97316");
    expect(cell.secondFill).toBe("#A855F7");
    expect(cell.notch).toBe(true);
  });

  it("lists a badge per activity in the tooltip, with notes carried through", () => {
    const cells = ACTIVITY_MODE.toCells(
      data([
        activity("2026-09-17", { activity_type: "lift", notes: "Squat 3×5 @ 185" }),
        activity("2026-09-17", { activity_type: "run" }),
      ]),
      ctx,
    );
    const tip = cellOn(cells, "2026-09-17")!.tooltip as ActivityTooltipData;
    expect(tip.items).toEqual([
      { label: "Lifting", color: "#A855F7", notes: "Squat 3×5 @ 185" },
      { label: "Run", color: "#F97316", notes: null },
    ]);
  });

  it("marks days outside the program as pre_program or future with no fill", () => {
    const cells = ACTIVITY_MODE.toCells(data([]), ctx);
    expect(cellOn(cells, "2026-09-13")).toMatchObject({ state: "pre_program", fill: null });
    expect(cellOn(cells, "2026-09-21")).toMatchObject({ state: "future", fill: null });
  });

  it("counts a hit steps goal as a Walk, using the real walk type's own color, when nothing else was logged", () => {
    const cells = ACTIVITY_MODE.toCells(data([], [stepsRow("2026-09-17", STEPS_GOAL)]), ctx);
    const cell = cellOn(cells, "2026-09-17")!;
    expect(cell).toMatchObject({ fill: "#14B8A6", secondFill: undefined, notch: undefined, state: "data" });
    expect((cell.tooltip as ActivityTooltipData).items).toEqual([{ label: "Walk", color: "#14B8A6", notes: "steps goal met" }]);
  });

  it("does not count a walk when steps fall short of the goal", () => {
    const cells = ACTIVITY_MODE.toCells(data([], [stepsRow("2026-09-17", STEPS_GOAL - 1)]), ctx);
    expect(cellOn(cells, "2026-09-17")).toMatchObject({ state: "none", fill: CELL_NO_DATA });
  });

  it("counts the steps-goal walk alongside a different real activity on the same day — always, not only when nothing else was logged", () => {
    const cells = ACTIVITY_MODE.toCells(
      data([activity("2026-09-17", { activity_type: "run" })], [stepsRow("2026-09-17", STEPS_GOAL)]),
      ctx,
    );
    const cell = cellOn(cells, "2026-09-17")!;
    expect(cell.fill).toBe("#F97316");
    expect(cell.secondFill).toBe("#14B8A6");
    expect(cell.notch).toBe(true);
    expect((cell.tooltip as ActivityTooltipData).items).toEqual([
      { label: "Run", color: "#F97316", notes: null },
      { label: "Walk", color: "#14B8A6", notes: "steps goal met" },
    ]);
  });

  it("counts the steps-goal walk alongside a REAL logged walk too — shows twice, by design (always means always)", () => {
    const cells = ACTIVITY_MODE.toCells(
      data([activity("2026-09-17", { activity_type: "walk", notes: "Evening walk" })], [stepsRow("2026-09-17", STEPS_GOAL)]),
      ctx,
    );
    const tip = cellOn(cells, "2026-09-17")!.tooltip as ActivityTooltipData;
    expect(tip.items).toEqual([
      { label: "Walk", color: "#14B8A6", notes: "Evening walk" },
      { label: "Walk", color: "#14B8A6", notes: "steps goal met" },
    ]);
  });
});

describe("ACTIVITY_MODE.legend", () => {
  it("lists every activity type from the DB plus multiple and none — no separate Steps entry", () => {
    const items = ACTIVITY_MODE.legend(ctx, data([]));
    expect(items.map((i) => i.label)).toEqual(["Run", "Lifting", "Walk", "multiple", "none"]);
  });
});
