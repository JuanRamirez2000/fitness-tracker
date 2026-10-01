import { describe, expect, it } from "vitest";
import { profileSettingsSchema } from "./profiles";

const VALID = {
  display_name: "Juan",
  timezone: "America/Los_Angeles",
  goal_weight_lb: 200,
  goal_pace_lb_per_week: 1,
  start_weight_lb: 232,
  shot_weekday: 4,
};

describe("profileSettingsSchema", () => {
  it("accepts a fully valid settings object", () => {
    expect(profileSettingsSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a timezone Intl.DateTimeFormat doesn't recognize", () => {
    const result = profileSettingsSchema.safeParse({ ...VALID, timezone: "Not/A_Zone" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/valid timezone/i);
  });

  it("allows the nullable goal fields to be cleared", () => {
    const result = profileSettingsSchema.safeParse({
      ...VALID,
      goal_weight_lb: null,
      goal_pace_lb_per_week: null,
      start_weight_lb: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty display name", () => {
    expect(profileSettingsSchema.safeParse({ ...VALID, display_name: "  " }).success).toBe(false);
  });

  it("rejects a goal_weight_lb outside a realistic human weight", () => {
    expect(profileSettingsSchema.safeParse({ ...VALID, goal_weight_lb: 12 }).success).toBe(false);
  });

  it("rejects an unrealistic goal_pace_lb_per_week", () => {
    expect(profileSettingsSchema.safeParse({ ...VALID, goal_pace_lb_per_week: 50 }).success).toBe(false);
  });
});
