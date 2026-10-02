import { describe, expect, it } from "vitest";
import type { DailySteps } from "@/lib/data/steps";
import { TODAY, testDashboardData } from "./testing";
import { stepsToday } from "./steps-today";

function withSteps(rows: [string, number][]) {
  const steps: DailySteps[] = rows.map(([local_date, n]) => ({ user_id: "u", local_date, steps: n, source: "garmin", updated_at: "" }));
  return testDashboardData({ heatmap: { window: { from: "2026-09-13", to: "2027-09-18" }, steps } });
}

describe("stepsToday", () => {
  it("is empty with no steps at all", () => {
    expect(stepsToday.compute(withSteps([]))).toBeNull();
  });

  it("shows today's count when it has synced", () => {
    const v = stepsToday.compute(withSteps([["2026-09-19", 4000], [TODAY, 12500]]))!;
    expect(v).toMatchObject({ value: 12500, tone: "good", deltaText: "10k hit", progress: 1 });
    expect(v.sub).toMatch(/^Today/);
  });

  it("falls back to the latest synced day and says which", () => {
    const v = stepsToday.compute(withSteps([["2026-09-19", 7500]]))!;
    expect(v).toMatchObject({ value: 7500, tone: "neutral", deltaText: "2.5k to go", progress: 0.75 });
    expect(v.sub).toMatch(/^Yesterday/);
    expect(stepsToday.format(v).primary).toBe("7,500");
  });
});
