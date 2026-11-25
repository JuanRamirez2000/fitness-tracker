import { describe, expect, it } from "vitest";
import type { DailyWeight } from "@/lib/data/weight-trend";
import type { Profile } from "@/lib/data/profiles";
import { resolveProgramStart, resolveShell, tabNeeds } from "./load";

const PROFILE = { id: "u", program_start_date: null } as unknown as Profile;
const WEIGH_IN: DailyWeight = { user_id: "u", local_date: "2026-08-01", weight_lb: 232.4 };

describe("resolveProgramStart", () => {
  it("prefers the profile's own program_start_date", () => {
    const profile = { ...PROFILE, program_start_date: "2026-09-17" };
    expect(resolveProgramStart(profile, WEIGH_IN, "2026-09-20")).toBe("2026-09-17");
  });

  it("falls back to the first weigh-in when the profile has no program_start_date", () => {
    expect(resolveProgramStart(PROFILE, WEIGH_IN, "2026-09-20")).toBe("2026-08-01");
  });

  it("falls back to today for a brand-new account with neither", () => {
    expect(resolveProgramStart(PROFILE, null, "2026-09-20")).toBe("2026-09-20");
  });
});

describe("tabNeeds", () => {
  it("loads weigh-ins and body composition only for the weight tab", () => {
    expect(tabNeeds("weight")).toMatchObject({ weighIns: true, bodyComposition: true, recovery: false, plans: false });
    expect(tabNeeds("training")).toMatchObject({ weighIns: false, bodyComposition: false });
  });

  it("loads recovery for Home and Log, the planner for Home and Training, best efforts where records or the card show", () => {
    expect(tabNeeds("home")).toMatchObject({ recovery: true, steps: false, plans: true, planner: true, runEfforts: false, training: true });
    expect(tabNeeds("training")).toMatchObject({ recovery: false, plans: false, planner: true, runEfforts: true, training: true });
    expect(tabNeeds("log")).toMatchObject({ recovery: true, steps: true, plans: true, planner: false, runEfforts: true });
  });
});

describe("resolveShell", () => {
  it("resolves the range from the first weigh-in, so the header needs only the first query", () => {
    const profile = { ...PROFILE, timezone: "America/Los_Angeles" };
    const shell = resolveShell(profile, WEIGH_IN, { rangeKey: "all", tab: "weight" }, "2026-09-20");
    expect(shell).toMatchObject({ tab: "weight", today: "2026-09-20", programStart: "2026-08-01", firstWeighIn: WEIGH_IN });
    expect(shell.dateRange).toEqual({ key: "all", from: "2026-08-01", to: "2026-09-20" });
  });
});
