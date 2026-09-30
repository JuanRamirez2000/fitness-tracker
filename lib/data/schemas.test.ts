import { describe, expect, it } from "vitest";
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
