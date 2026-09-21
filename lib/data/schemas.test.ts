import { describe, expect, it } from "vitest";
import { activityTypeSchema } from "./activity-types";
import { activityRowSchema, activitySchema } from "./activities";
import { STEPS_MAX, stepsSchema } from "./daily-metrics";
import { featureRequestSchema } from "./feature-requests";
import { injectionSchema } from "./injections";
import { nutritionDaySchema } from "./nutrition-days";
import { weighInRowSchema, weighInSchema } from "./weigh-ins";
import { weightTrendRowSchema } from "./weight-trend";

const USER = "6f0c1c1e-1d0a-4b5e-9c3e-2f6a1d8b7c01";
const DATE = "2026-09-20";

// Boundaries below mirror the CHECK constraints in schema.sql.

describe("weighInSchema", () => {
  it("accepts the DB range 50..800 inclusive", () => {
    expect(weighInSchema.safeParse({ local_date: DATE, weight_lb: 50 }).success).toBe(true);
    expect(weighInSchema.safeParse({ local_date: DATE, weight_lb: 800 }).success).toBe(true);
  });

  it("rejects values outside it and impossible dates", () => {
    expect(weighInSchema.safeParse({ local_date: DATE, weight_lb: 49.9 }).success).toBe(false);
    expect(weighInSchema.safeParse({ local_date: DATE, weight_lb: 800.1 }).success).toBe(false);
    expect(weighInSchema.safeParse({ local_date: "2026-02-30", weight_lb: 200 }).success).toBe(
      false,
    );
  });

  it("parses a raw row and drops columns it does not model", () => {
    const parsed = weighInRowSchema.parse({
      id: "0b8f7a54-3c53-4c7b-8d0f-5b5b3f0e9a11",
      user_id: USER,
      measured_at: "2026-09-20T14:05:00+00:00",
      local_date: DATE,
      weight_lb: 231.6,
      source: "manual",
      external_id: null,
      created_at: "2026-09-20T14:05:01.123456+00:00",
      unexpected: "column",
    });
    expect(parsed).not.toHaveProperty("unexpected");
    expect(parsed.weight_lb).toBe(231.6);
  });

  it("rejects an unknown source", () => {
    expect(() =>
      weighInRowSchema.parse({
        id: "0b8f7a54-3c53-4c7b-8d0f-5b5b3f0e9a11",
        user_id: USER,
        measured_at: "2026-09-20T14:05:00+00:00",
        local_date: DATE,
        weight_lb: 231.6,
        source: "scale",
        external_id: null,
        created_at: "2026-09-20T14:05:00+00:00",
      }),
    ).toThrow();
  });
});

describe("nutritionDaySchema", () => {
  const base = { local_date: DATE, tracking_status: "accurate", calories_kcal: null, notes: null };

  it("accepts each tracking status and a null calorie total", () => {
    for (const tracking_status of ["accurate", "uncertain", "missed"]) {
      expect(nutritionDaySchema.safeParse({ ...base, tracking_status }).success).toBe(true);
    }
  });

  it("uses uncertain, not the design's 'off'", () => {
    expect(nutritionDaySchema.safeParse({ ...base, tracking_status: "off" }).success).toBe(false);
  });

  it("bounds kcal to 0..20000 and whole numbers", () => {
    expect(nutritionDaySchema.safeParse({ ...base, calories_kcal: 0 }).success).toBe(true);
    expect(nutritionDaySchema.safeParse({ ...base, calories_kcal: 20000 }).success).toBe(true);
    expect(nutritionDaySchema.safeParse({ ...base, calories_kcal: 20001 }).success).toBe(false);
    expect(nutritionDaySchema.safeParse({ ...base, calories_kcal: -1 }).success).toBe(false);
    expect(nutritionDaySchema.safeParse({ ...base, calories_kcal: 1800.5 }).success).toBe(false);
  });
});

describe("activitySchema", () => {
  const base = { local_date: DATE, activity_type: "lift", duration_min: null, notes: null };

  it("allows lifting with free-text notes and no duration", () => {
    expect(
      activitySchema.safeParse({ ...base, notes: "Squat 3×5 @ 185 · bench 3×8" }).success,
    ).toBe(true);
  });

  it("requires a positive whole-minute duration when one is given", () => {
    expect(activitySchema.safeParse({ ...base, duration_min: 45 }).success).toBe(true);
    expect(activitySchema.safeParse({ ...base, duration_min: 0 }).success).toBe(false);
    expect(activitySchema.safeParse({ ...base, duration_min: 12.5 }).success).toBe(false);
  });

  it("requires a type", () => {
    expect(activitySchema.safeParse({ ...base, activity_type: "" }).success).toBe(false);
  });

  it("round-trips a row with a Garmin external id", () => {
    expect(() =>
      activityRowSchema.parse({
        ...base,
        id: "0b8f7a54-3c53-4c7b-8d0f-5b5b3f0e9a11",
        user_id: USER,
        source: "garmin",
        external_id: "abc-123",
        created_at: "2026-09-20T14:05:00+00:00",
      }),
    ).not.toThrow();
  });
});

describe("stepsSchema", () => {
  it("accepts whole, non-negative counts up to the sanity cap", () => {
    expect(stepsSchema.safeParse({ local_date: DATE, value: 0 }).success).toBe(true);
    expect(stepsSchema.safeParse({ local_date: DATE, value: 10400 }).success).toBe(true);
    expect(stepsSchema.safeParse({ local_date: DATE, value: STEPS_MAX }).success).toBe(true);
  });

  it("rejects negatives, fractions and a likely extra zero", () => {
    expect(stepsSchema.safeParse({ local_date: DATE, value: -1 }).success).toBe(false);
    expect(stepsSchema.safeParse({ local_date: DATE, value: 10400.5 }).success).toBe(false);
    expect(stepsSchema.safeParse({ local_date: DATE, value: STEPS_MAX + 1 }).success).toBe(false);
  });
});

describe("injectionSchema", () => {
  it("allows no dose and bounds dose to numeric(5,2)", () => {
    expect(injectionSchema.safeParse({ local_date: DATE, dose_mg: null, notes: null }).success).toBe(
      true,
    );
    expect(injectionSchema.safeParse({ local_date: DATE, dose_mg: 2.5, notes: null }).success).toBe(
      true,
    );
    expect(
      injectionSchema.safeParse({ local_date: DATE, dose_mg: 1000, notes: null }).success,
    ).toBe(false);
    expect(injectionSchema.safeParse({ local_date: DATE, dose_mg: -1, notes: null }).success).toBe(
      false,
    );
  });
});

describe("featureRequestSchema", () => {
  it("trims and enforces 1..2000 characters", () => {
    expect(featureRequestSchema.parse({ body: "  Add protein  " }).body).toBe("Add protein");
    expect(featureRequestSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(featureRequestSchema.safeParse({ body: "x".repeat(2000) }).success).toBe(true);
    expect(featureRequestSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("activityTypeSchema", () => {
  it("requires a #rrggbb color because it feeds color math", () => {
    const type = { key: "run", label: "Run", color: "#F97316", sort_order: 1 };
    expect(activityTypeSchema.safeParse(type).success).toBe(true);
    expect(activityTypeSchema.safeParse({ ...type, color: "orange" }).success).toBe(false);
    expect(activityTypeSchema.safeParse({ ...type, color: "#f70" }).success).toBe(false);
  });
});

describe("weightTrendRowSchema", () => {
  it("allows null deltas on the first ever row", () => {
    expect(
      weightTrendRowSchema.parse({
        user_id: USER,
        local_date: "2026-09-17",
        weight_lb: 232.4,
        avg7_lb: 232.4,
        n7: 1,
        raw_delta_lb: null,
        avg7_delta_lb: null,
      }).raw_delta_lb,
    ).toBeNull();
  });
});
