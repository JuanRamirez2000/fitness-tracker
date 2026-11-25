import { describe, expect, it } from "vitest";
import { readyBy, splitFactors } from "./daily";

const TZ = "America/Los_Angeles";

describe("readyBy", () => {
  const now = new Date("2026-11-11T18:00:00Z"); // 10 am Pacific
  it("gives the clock time recovery runs out, with the weekday when it isn't today", () => {
    expect(readyBy({ recovery_hours: 6, readiness_at: "2026-11-11T17:00:00Z" }, TZ, now)).toEqual({ ready: false, label: "3:00 pm" });
    expect(readyBy({ recovery_hours: 30, readiness_at: "2026-11-11T17:00:00Z" }, TZ, now)!.label).toMatch(/^Thu /);
    expect(readyBy({ recovery_hours: 0, readiness_at: "2026-11-11T17:00:00Z" }, TZ, now)).toEqual({ ready: true, label: "Now" });
  });
});

describe("splitFactors", () => {
  it("puts Good factors under helping and the rest under holding back, weakest first", () => {
    const { helping, holding } = splitFactors([
      { key: "hrv", label: "HRV", percent: 92, state: "good" },
      { key: "sleep", label: "Sleep", percent: 70, state: "fair" },
      { key: "recovery_time", label: "Recovery time", percent: 40, state: "low" },
    ]);
    expect(helping.map((p) => p.text)).toEqual(["HRV in its normal range"]);
    expect(holding.map((p) => p.text)).toEqual(["Still recovering from recent workouts", "A short or restless night"]);
  });
});
