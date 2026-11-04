import { describe, expect, it } from "vitest";
import { testTraining, trendRow } from "@/lib/kpis/testing";
import { testNight, testRecovery } from "@/lib/today/testing";
import { hasEnoughForSummary, summaryFacts, summaryUserMessage } from "./prompt";

const TODAY = "2026-11-03";

describe("summaryFacts", () => {
  it("collects today's readiness, sleep, HRV, load and weight trend", () => {
    const facts = summaryFacts({
      today: TODAY,
      recovery: [
        testRecovery({
          local_date: TODAY,
          readiness_score: 63,
          readiness_level: "MODERATE",
          readiness_morning_score: 85,
          readiness_factors: { sleep_history: 65, hrv: 100, recovery_time: 61, acwr: 75, stress_history: 92, sleep: 80 },
          recovery_hours: 24.2,
          hrv_ms: 46,
          hrv_baseline_low: 40,
          hrv_baseline_high: 50,
          hrv_status: "BALANCED",
          resting_hr: 51,
          body_battery_wake: 80,
        }),
      ],
      sleep: [testNight({ local_date: TODAY })],
      training: [testTraining({ local_date: TODAY, acute_load: 237, chronic_load: 172, acwr: 1.3, status: "PRODUCTIVE" })],
      weightTrend: [
        trendRow({ local_date: "2026-10-27", weight_lb: 274, avg7_lb: 273.4 }),
        trendRow({ local_date: TODAY, weight_lb: 272.4, avg7_lb: 272.8 }),
      ],
    });
    expect(facts).toEqual({
      date: TODAY,
      training_readiness: {
        score_0_100: 63,
        level: "MODERATE",
        score_at_wake: 85,
        factors_percent: { "Sleep history": 65, HRV: 100, "Recovery time": 61, "Acute load ratio": 75, "Stress history": 92, Sleep: 80 },
        recovery_time_left_hours: 24.2,
      },
      last_night_sleep: { hours: 7.5, need_hours: 7.7, score_0_100: 85, deep_hours: 2.1, rem_hours: 1.9 },
      overnight_hrv: { ms: 46, normal_range_ms: [40, 50], status: "BALANCED" },
      resting_hr_bpm: 51,
      body_battery_at_wake_0_100: 80,
      training_load: { acute: 237, chronic: 172, acute_chronic_ratio: 1.3, status: "Productive" },
      weight_lb: { seven_day_average: 272.8, change_vs_a_week_ago: -0.6 },
    });
    expect(hasEnoughForSummary(facts)).toBe(true);
    expect(summaryUserMessage(facts)).toContain('"score_0_100": 63');
  });

  it("leaves out what doesn't exist, including stale days", () => {
    const facts = summaryFacts({
      today: TODAY,
      recovery: [testRecovery({ local_date: "2026-11-02", readiness_score: 58 })], // yesterday's readiness: not today's
      sleep: [],
      training: [testTraining({ local_date: "2026-10-20", acute_load: 200, chronic_load: 160 })], // two weeks old
      weightTrend: [trendRow({ local_date: "2026-10-01", weight_lb: 280, avg7_lb: 280 })], // a month old
    });
    expect(facts).toEqual({ date: TODAY });
    expect(hasEnoughForSummary(facts)).toBe(false);
  });
});
