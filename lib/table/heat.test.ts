import { describe, expect, it } from "vitest";
import { CELL_FLAT, CELL_NO_DATA } from "@/lib/heatmap/colors";
import { trendRow } from "@/lib/kpis/testing";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { dayHeat } from "./heat";

describe("dayHeat", () => {
  const trend = [
    trendRow({ local_date: "2026-09-01", weight_lb: 280, n7: 1 }),
    trendRow({ local_date: "2026-09-02", weight_lb: 278, raw_delta_lb: -2, avg7_lb: 279, avg7_delta_lb: -1, n7: 2 }),
    trendRow({ local_date: "2026-09-03", weight_lb: 281, raw_delta_lb: 3, avg7_lb: 279.7, avg7_delta_lb: 0.7, n7: 3 }),
    trendRow({ local_date: "2026-09-04", weight_lb: 281, raw_delta_lb: 0, avg7_lb: 280, avg7_delta_lb: 0.3, n7: 4 }),
  ];
  const heat = dayHeat(trend, DEFAULT_PALETTE);

  it("leaves the first ever weigh-in uncolored, with no delta", () => {
    expect(heat.get("2026-09-01")!.raw).toEqual({ deltaLb: null, fill: CELL_NO_DATA });
  });

  it("colors a loss and a gain differently, and a flat day neutral", () => {
    const down = heat.get("2026-09-02")!.raw.fill;
    const up = heat.get("2026-09-03")!.raw.fill;
    expect(down).not.toBe(up);
    expect([down, up]).not.toContain(CELL_FLAT);
    expect(heat.get("2026-09-04")!.raw.fill).toBe(CELL_FLAT);
  });

  it("matches the heatmap's warming-up rule for the 7-day average", () => {
    expect(heat.get("2026-09-02")!.avg7).toMatchObject({ warmingUp: true, fill: null });
    expect(heat.get("2026-09-03")!.avg7).toMatchObject({ warmingUp: false, avg7Lb: 279.7, deltaLb: 0.7 });
  });
});
