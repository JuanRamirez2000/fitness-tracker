import { describe, expect, it } from "vitest";
import { daysSinceShot } from "./days-since-shot";
import { testDashboardData, USER } from "./testing";

function injection(local_date: string): { id: string; user_id: string; local_date: string; dose_mg: null; notes: null; created_at: string } {
  return { id: crypto.randomUUID(), user_id: USER, local_date, dose_mg: null, notes: null, created_at: "" };
}

describe("daysSinceShot", () => {
  it("is the empty state with no shot ever logged", () => {
    expect(daysSinceShot.compute(testDashboardData())).toBeNull();
  });

  it("counts days since the most recent shot at or before today", () => {
    const data = testDashboardData({ injections: [injection("2026-09-17")] });
    expect(daysSinceShot.compute(data)).toMatchObject({ value: 3, unit: "days" });
  });

  it("ignores a shot logged in the future and picks the latest past one, in any input order", () => {
    const data = testDashboardData({
      injections: [injection("2026-09-25"), injection("2026-09-10"), injection("2026-09-17")],
    });
    expect(daysSinceShot.compute(data)!.value).toBe(3); // vs Sep 17, not Sep 25 or Sep 10
  });

  it("uses the singular unit for exactly 1 and previews the next shot 7 days out", () => {
    const data = testDashboardData({ today: "2026-09-18", injections: [injection("2026-09-17")] });
    const value = daysSinceShot.compute(data)!;
    expect(value.unit).toBe("day");
    expect(value.sub).toBe("Next Sep 24");
  });
});
