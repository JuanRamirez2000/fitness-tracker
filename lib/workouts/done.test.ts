import { describe, expect, it } from "vitest";
import { TODAY, testDashboardData, testRide, testRun } from "@/lib/kpis/testing";
import { doneToday } from "./done";

describe("doneToday", () => {
  it("lists only today's activities, oldest first, with their sport and moving time", () => {
    const data = testDashboardData({
      today: TODAY,
      activities: [
        testRun({ local_date: TODAY, started_at: `${TODAY}T18:00:00Z`, moving_duration_s: 1800 }),
        testRide({ local_date: TODAY, started_at: `${TODAY}T14:00:00Z`, moving_duration_s: 3600 }),
        testRun({ local_date: "2026-01-01" }),
      ],
    });
    expect(doneToday(data).map((a) => [a.sport, a.durationS])).toEqual([
      ["ride", 3600],
      ["run", 1800],
    ]);
  });
});
