import { describe, expect, it } from "vitest";
import { testDashboardData, testRide, testRun, trendRow } from "@/lib/kpis/testing";
import { progressWeek } from "@/lib/progress/week";
import { homeTiles, logTiles, trainingTiles, weightTiles } from "./week-so-far";

const week = progressWeek("2026-11-16", "2026-11-18");

describe("week so far", () => {
  it("Training: time by sport, run miles and ride time for the week through today", () => {
    const data = testDashboardData({
      today: "2026-11-18",
      activities: [testRun({ local_date: "2026-11-17" }), testRide({ local_date: "2026-11-16", moving_duration_s: 3600 }), testRun({ local_date: "2026-11-10" })],
    });
    const tiles = Object.fromEntries(trainingTiles(data, week).map((t) => [t.key, t]));
    expect(tiles.time).toMatchObject({ value: "1.6 h", sub: "ride 1.0 · run 0.6" });
    expect(tiles.run).toMatchObject({ value: "3.0", sub: "1 run" });
    expect(tiles.ride).toMatchObject({ value: "1.0 h", sub: "1 ride" });
  });

  it("Home: training time against the band, and no next-session tile for a past week", () => {
    const data = testDashboardData({ today: "2026-11-18", activities: [testRun({ local_date: "2026-11-17" })] });
    expect(homeTiles(data, week)[0]).toMatchObject({ key: "hours", value: "0.6 h", sub: "aim 4–7 h" });
    expect(homeTiles(data, progressWeek("2026-11-09", "2026-11-18")).some((t) => t.key === "next")).toBe(false);
  });

  it("Weight: the 7-day average's change over the week and the weigh-in count", () => {
    const data = testDashboardData({
      today: "2026-11-18",
      weightTrend: [
        trendRow({ local_date: "2026-11-15", weight_lb: 266, avg7_lb: 266 }),
        trendRow({ local_date: "2026-11-17", weight_lb: 264.8, avg7_lb: 265.2 }),
      ],
    });
    const tiles = Object.fromEntries(weightTiles(data, week).map((t) => [t.key, t]));
    expect(tiles.avg).toMatchObject({ value: "265.2 lb", sub: "−0.8 lb this week", tone: "good" });
    expect(tiles.count).toMatchObject({ value: "1", sub: "of 3 days" });
  });

  it("Log: counts of what got logged", () => {
    const data = testDashboardData({ today: "2026-11-18", activities: [testRun({ local_date: "2026-11-17" })] });
    expect(logTiles(data, week).map((t) => `${t.label} ${t.value}`)).toEqual(["Activities 1", "Weigh-ins 0", "Mood logs 0", "Nights of sleep 0", "Readiness mornings 0"]);
  });
});
