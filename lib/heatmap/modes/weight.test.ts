import { describe, expect, it } from "vitest";
import type { WeightTrendRow } from "@/lib/data/weight-trend";
import type { DashboardData, ModeContext } from "@/lib/dashboard/types";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { WEIGHT_MODE, type WeightTooltipData } from "./weight";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
// heatmapWindow anchors to the Sunday of the program-start week, so the window (Sep 13) opens
// 4 days before the real program start (Sep 17, a Thursday) — those 4 days are pre_program.
const WINDOW_FROM = "2026-09-13";
const PROGRAM_START = "2026-09-17";
const TODAY = "2026-09-20";

function trend(over: Partial<WeightTrendRow> & { local_date: string; weight_lb: number }): WeightTrendRow {
  return {
    user_id: USER,
    avg7_lb: over.weight_lb,
    n7: 7,
    raw_delta_lb: null,
    avg7_delta_lb: null,
    ...over,
  };
}

function data(weightTrend: WeightTrendRow[]): DashboardData {
  return {
    profile: {} as DashboardData["profile"],
    activityTypes: [],
    today: TODAY,
    programStart: PROGRAM_START,
    firstWeighIn: null,
    weightTrend,
    injections: [],
    heatmap: { window: { from: WINDOW_FROM, to: "2027-09-18" }, nutritionDays: [], activities: [], steps: [] },
    range: { window: { from: TODAY, to: TODAY }, nutritionDays: [], activities: [], steps: [] },
    dateRange: { key: "week", from: TODAY, to: TODAY },
  };
}

function ctx(overrides: Partial<ModeContext> = {}): ModeContext {
  return {
    range: { key: "week", from: TODAY, to: TODAY },
    palette: DEFAULT_PALETTE,
    weightSubMode: "avg7",
    ...overrides,
  };
}

const cellOn = (cells: ReturnType<typeof WEIGHT_MODE.toCells>, date: string) =>
  cells.find((c) => c.date === date);

describe("WEIGHT_MODE.toCells", () => {
  it("marks days before the program start as pre_program with no fill", () => {
    const cells = WEIGHT_MODE.toCells(data([]), ctx());
    expect(cellOn(cells, "2026-09-13")).toMatchObject({ state: "pre_program", fill: null });
  });

  it("marks days after today as future with no fill", () => {
    const cells = WEIGHT_MODE.toCells(data([]), ctx());
    expect(cellOn(cells, "2026-09-21")).toMatchObject({ state: "future", fill: null });
  });

  it("marks an in-program day with no weigh-in as none", () => {
    const cells = WEIGHT_MODE.toCells(data([]), ctx());
    expect(cellOn(cells, "2026-09-17")?.state).toBe("none");
  });

  it("colors a day with a weigh-in and carries the tooltip", () => {
    const rows = [
      trend({ local_date: "2026-09-17", weight_lb: 232.4 }),
      trend({ local_date: "2026-09-18", weight_lb: 230.4, avg7_lb: 230.4, raw_delta_lb: -2, avg7_delta_lb: -2 }),
    ];
    const cells = WEIGHT_MODE.toCells(data(rows), ctx());
    const cell = cellOn(cells, "2026-09-18")!;
    expect(cell.state).toBe("data");
    expect(cell.fill).not.toBeNull();
    const tip = cell.tooltip as WeightTooltipData;
    expect(tip.rawLb).toBe(230.4);
    expect(tip.avg7Lb).toBe(230.4);
    expect(tip.avg7.vsDate).toBe("2026-09-17");
  });

  it("still shows a correct tooltip and color on the first day of a trailing window, using history before it", () => {
    // weightTrend has a day before the heatmap window's start; toCells must still see it.
    const rows = [
      trend({ local_date: "2027-09-12", weight_lb: 200 }), // before the trailing window
      trend({ local_date: "2027-09-19", weight_lb: 199, avg7_lb: 199, raw_delta_lb: -1, avg7_delta_lb: -1 }), // window's first day
    ];
    const trailing = data(rows);
    trailing.heatmap.window = { from: "2027-09-19", to: "2028-09-17" };
    trailing.today = "2027-09-20";
    const cells = WEIGHT_MODE.toCells(trailing, ctx());
    const cell = cellOn(cells, "2027-09-19")!;
    expect(cell.fill).not.toBeNull();
    expect((cell.tooltip as WeightTooltipData).avg7.vsDate).toBe("2027-09-12");
  });

  it("switches which value colors the cell between raw and avg7", () => {
    const row = trend({ local_date: "2026-09-17", weight_lb: 200, n7: 1, raw_delta_lb: -1, avg7_delta_lb: -1 });
    const raw = WEIGHT_MODE.toCells(data([row]), ctx({ weightSubMode: "raw" }));
    const avg7 = WEIGHT_MODE.toCells(data([row]), ctx({ weightSubMode: "avg7" }));
    // n7 = 1 is below MIN_AVG7_SAMPLES, so avg7 mode is warming up while raw mode is not.
    expect(cellOn(avg7, "2026-09-17")?.state).toBe("warming_up");
    expect(cellOn(raw, "2026-09-17")?.state).toBe("data");
  });

  it("flags a cell as dimmed when it falls outside the selected range", () => {
    const cells = WEIGHT_MODE.toCells(data([]), ctx({ range: { key: "week", from: TODAY, to: TODAY } }));
    expect(cellOn(cells, TODAY)?.inRange).toBe(true);
    expect(cellOn(cells, "2026-09-19")?.inRange).toBe(false);
  });
});

describe("WEIGHT_MODE.legend", () => {
  it("has five entries and follows the active palette", () => {
    const items = WEIGHT_MODE.legend(ctx());
    expect(items).toHaveLength(5);
    expect(items.find((i) => i.label === "down")?.swatch).toBe(DEFAULT_PALETTE.good);
    expect(items.find((i) => i.label === "up")?.swatch).toBe(DEFAULT_PALETTE.bad);
  });
});
