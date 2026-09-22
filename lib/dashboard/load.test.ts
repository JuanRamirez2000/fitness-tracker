import { describe, expect, it } from "vitest";
import type { DailyWeight } from "@/lib/data/weight-trend";
import type { Profile } from "@/lib/data/profiles";
import { resolveProgramStart } from "./load";

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
