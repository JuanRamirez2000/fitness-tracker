import { describe, expect, it } from "vitest";
import { jwtExpiryMs, parseTokenResponse } from "./client";
import { resolveWindow, wellnessWindow } from "./import";
import { readFileSync } from "node:fs";
import { buildActivityRows, buildRecoveryRows, buildSleepRows, buildStepsRows, buildWeighInRows } from "./map";
import type { RawHrvDay, RawSleepNight, RawUserSummary, RawWeighIn } from "./map";

/** A sample Garmin response from lib/garmin/fixtures/ (real, anonymised). */
function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;
}

describe("buildWeighInRows", () => {
  it("converts grams to pounds and keys on samplePk", () => {
    const rows = buildWeighInRows([
      { samplePk: 1793716361000, calendarDate: "2026-11-03", timestampGMT: 1793716361000, weight: 123540 },
    ]);
    expect(rows).toEqual([
      {
        measured_at: new Date(1793716361000).toISOString(),
        local_date: "2026-11-03",
        weight_lb: 272.4,
        external_id: "1793716361000",
        body_fat_pct: null,
        muscle_mass_lb: null,
        bone_mass_lb: null,
        body_water_pct: null,
      },
    ]);
  });

  it("carries the Index scale's body composition, converted to pounds", () => {
    const body = fixture<{ dailyWeightSummaries: { allWeightMetrics: RawWeighIn[] }[] }>("weight-range.json");
    const rows = buildWeighInRows(body.dailyWeightSummaries.flatMap((d) => d.allWeightMetrics));
    const scale = rows.find((r) => r.body_fat_pct !== null)!;
    expect(scale).toMatchObject({ local_date: "2026-11-03", weight_lb: 272.4, body_fat_pct: 33.9, body_water_pct: 48.3 });
    expect(scale.muscle_mass_lb).toBeCloseTo(99.58, 2); // 45169 g
    expect(scale.bone_mass_lb).toBeCloseTo(16.75, 2); // 7599 g
    const manual = rows.find((r) => r.body_fat_pct === null);
    if (manual) expect(manual.muscle_mass_lb).toBeNull();
  });

  it("skips entries without an ID and out-of-range weights", () => {
    const warnings: string[] = [];
    const rows = buildWeighInRows(
      [
        { calendarDate: "2026-11-03", timestampGMT: 1, weight: 123540 },
        { samplePk: 2, calendarDate: "2026-11-03", timestampGMT: 1, weight: 10_000 },
      ],
      (m) => warnings.push(m),
    );
    expect(rows).toEqual([]);
    expect(warnings).toHaveLength(1);
  });
});

describe("buildStepsRows", () => {
  it("drops days with no step total", () => {
    expect(
      buildStepsRows([
        { calendarDate: "2026-11-02", totalSteps: 8123 },
        { calendarDate: "2026-11-03", totalSteps: null },
      ]),
    ).toEqual([{ local_date: "2026-11-02", steps: 8123 }]);
  });
});

describe("buildActivityRows", () => {
  it("takes local_date from the local clock and started_at from GMT", () => {
    const [row] = buildActivityRows([
      {
        activityId: 42,
        activityName: "Evening Run",
        activityType: { typeKey: "running" },
        startTimeLocal: "2026-11-02 18:30:00",
        startTimeGMT: "2026-11-03 02:30:00",
        duration: 1800.5,
        averageHR: 151.6,
        vO2MaxValue: 48.2,
        fastestSplit_1609: 455.1,
      },
    ]);
    expect(row.local_date).toBe("2026-11-02");
    expect(row.started_at).toBe("2026-11-03T02:30:00.000Z");
    expect(row.external_id).toBe("42");
    expect(row.avg_hr).toBe(152);
    expect(row.vo2max).toBe(48);
    expect(row.fastest_mile_s).toBe(455.1);
    expect(row.distance_m).toBeNull();
  });

  it("skips activities missing an ID or start time", () => {
    expect(buildActivityRows([{ activityId: 1, startTimeLocal: "2026-11-02 18:30:00" }])).toEqual([]);
  });
});

describe("resolveWindow", () => {
  it("covers each window kind", () => {
    expect(resolveWindow({ kind: "today" }, "2026-11-03")).toEqual({ start: "2026-11-03", end: "2026-11-03" });
    expect(resolveWindow({ kind: "yesterday" }, "2026-11-01")).toEqual({ start: "2026-10-31", end: "2026-10-31" });
    expect(resolveWindow({ kind: "days", days: 7 }, "2026-11-03")).toEqual({ start: "2026-10-28", end: "2026-11-03" });
    expect(resolveWindow({ kind: "since", since: "2026-01-01" }, "2026-11-03")).toEqual({ start: "2026-01-01", end: "2026-11-03" });
  });
});

describe("wellnessWindow", () => {
  it("extends the nightly yesterday window to today, since sleep lands on the wake-up day", () => {
    expect(wellnessWindow({ kind: "yesterday" }, "2026-11-03")).toEqual({ start: "2026-11-02", end: "2026-11-03" });
  });

  it("leaves every other window as is", () => {
    expect(wellnessWindow({ kind: "today" }, "2026-11-03")).toEqual({ start: "2026-11-03", end: "2026-11-03" });
    expect(wellnessWindow({ kind: "days", days: 7 }, "2026-11-03")).toEqual({ start: "2026-10-28", end: "2026-11-03" });
  });
});

describe("token helpers", () => {
  it("reads a bare or JSON token response", () => {
    expect(parseTokenResponse("abc.def.ghi\n")).toBe("abc.def.ghi");
    expect(parseTokenResponse('{"access_token":"abc.def.ghi"}')).toBe("abc.def.ghi");
  });

  it("reads a JWT's expiry", () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1_800_000_000 })).toString("base64url");
    expect(jwtExpiryMs(`h.${payload}.s`)).toBe(1_800_000_000_000);
    expect(jwtExpiryMs("not-a-jwt")).toBeNull();
  });
});

describe("buildSleepRows", () => {
  it("maps a real night, keyed by the wake-up day, and skips the empty day", () => {
    const rows = buildSleepRows(fixture<RawSleepNight[]>("sleep-summaries.json"));
    expect(rows).toEqual([
      {
        local_date: "2026-11-03",
        bedtime: new Date(1793689415000).toISOString(),
        wake_time: new Date(1793718575000).toISOString(),
        duration_s: 27000,
        deep_s: 7380,
        rem_s: 6900,
        light_s: 12720,
        awake_s: 2160,
        score: 85,
        need_s: 460 * 60,
      },
    ]);
  });
});

describe("buildRecoveryRows", () => {
  it("merges HRV nights with the day's summary", () => {
    const hrv = fixture<{ hrvSummaries: RawHrvDay[] }>("hrv-daily.json").hrvSummaries;
    const summary = fixture<RawUserSummary>("usersummary-daily.json");
    const rows = buildRecoveryRows(hrv, [summary]);
    expect(rows.map((r) => r.local_date)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(rows[1]).toMatchObject({
      local_date: "2026-11-03",
      resting_hr: 51,
      body_battery_high: 80,
      body_battery_low: 18,
      body_battery_wake: 80,
      avg_stress: 26,
      hrv_status: "BALANCED",
    });
    expect(rows[1].hrv_ms).toBeGreaterThan(0);
    expect(rows[1].hrv_baseline_low).toBeLessThan(rows[1].hrv_baseline_high!);
    // Nov 2 has HRV only: the summary columns stay null.
    expect(rows[0].resting_hr).toBeNull();
  });

  it("treats Garmin's not-enough-data sentinels as missing and drops empty days", () => {
    const rows = buildRecoveryRows([], [
      { calendarDate: "2026-11-01", restingHeartRate: 0, averageStressLevel: -1, bodyBatteryAtWakeTime: null },
      { calendarDate: "2026-11-02", restingHeartRate: 52, averageStressLevel: -2, bodyBatteryLowestValue: 0 },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ local_date: "2026-11-02", resting_hr: 52, avg_stress: null, body_battery_low: 0 }),
    ]);
  });
});
