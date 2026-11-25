import { describe, expect, it } from "vitest";
import { testDashboardData, testRun } from "@/lib/kpis/testing";
import { progressWeek } from "@/lib/progress/week";
import { homeTiles } from "./week-so-far";

const week = progressWeek("2026-11-16", "2026-11-18");

describe("homeTiles", () => {

  it("Home: training time against the band, and no next-session tile for a past week", () => {
    const data = testDashboardData({ today: "2026-11-18", activities: [testRun({ local_date: "2026-11-17" })] });
    expect(homeTiles(data, week)[0]).toMatchObject({ key: "hours", value: "0.6 h", sub: "aim 4–7 h" });
    expect(homeTiles(data, progressWeek("2026-11-09", "2026-11-18")).some((t) => t.key === "next")).toBe(false);
  });

});
