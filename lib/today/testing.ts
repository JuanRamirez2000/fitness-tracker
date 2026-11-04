import type { DailyRecovery, SleepNight } from "@/lib/data/recovery";

const USER = "00000000-0000-4000-8000-000000000001";

/** A recovery row with every column null except the date, unless overridden. */
export function testRecovery(over: Partial<DailyRecovery> & { local_date: string }): DailyRecovery {
  return {
    user_id: USER,
    resting_hr: null,
    hrv_ms: null,
    hrv_baseline_low: null,
    hrv_baseline_high: null,
    hrv_status: null,
    body_battery_high: null,
    body_battery_low: null,
    body_battery_wake: null,
    avg_stress: null,
    readiness_score: null,
    readiness_level: null,
    readiness_factors: null,
    readiness_at: null,
    readiness_morning_score: null,
    recovery_hours: null,
    ...over,
  };
}

/** The real night of Nov 2 -> 3 (lib/garmin/fixtures/sleep-summaries.json), unless overridden. */
export function testNight(over: Partial<SleepNight> & { local_date: string }): SleepNight {
  return {
    user_id: USER,
    bedtime: "2026-11-03T07:03:35.000Z",
    wake_time: "2026-11-03T15:09:35.000Z",
    duration_s: 27000,
    deep_s: 7380,
    rem_s: 6900,
    light_s: 12720,
    awake_s: 2160,
    score: 85,
    need_s: 27600,
    ...over,
  };
}
