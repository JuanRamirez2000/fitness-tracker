import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { METERS_PER_MILE, buildActivityDetailRow, mileSplits, readSamples, thinSeries, type RawActivityDetails, type RawActivityRecord } from "./details";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as T;

/** Details with the given metric columns, one row per sample. */
function details(columns: Record<string, (number | null)[]>): RawActivityDetails {
  const keys = Object.keys(columns);
  const n = columns[keys[0]].length;
  return {
    metricDescriptors: keys.map((key, metricsIndex) => ({ key, metricsIndex })),
    activityDetailMetrics: Array.from({ length: n }, (_, i) => ({ metrics: keys.map((k) => columns[k][i]) })),
  };
}

describe("buildActivityDetailRow", () => {
  const row = buildActivityDetailRow(fixture("activity-details.json"), fixture("activity.json"), { withMileSplits: true });

  it("reads feel, RPE, location and stamina from the activity record", () => {
    expect(row).toMatchObject({
      location_name: "Sample Town",
      workout_feel: 0,
      workout_rpe: 60,
      min_hr: 97,
      stamina_start: 100,
      stamina_end: 84,
    });
  });

  it("thins a real run's samples into parallel columns", () => {
    const s = row.series!;
    expect(s.t.length).toBeLessThanOrEqual(400);
    expect(s.t.length).toBeGreaterThan(150);
    for (const key of ["d", "hr", "speed", "gap", "cadence", "elev", "power", "lat", "lon", "bb", "stamina"] as const) {
      expect(s[key], key).toHaveLength(s.t.length);
    }
    // Timer time and distance only ever grow.
    expect(s.t.every((v, i) => i === 0 || v >= s.t[i - 1])).toBe(true);
    expect(s.d!.at(-1)).toBeGreaterThan(4000);
    // Running cadence is both feet: a median around 150-160 spm, not half that.
    const cadence = s.cadence!.filter((v): v is number => v !== null).sort((a, b) => a - b);
    expect(cadence[Math.floor(cadence.length / 2)]).toBeGreaterThan(130);
  });

  it("splits a 2.5-mile run into two whole miles and a partial", () => {
    const splits = row.mile_splits!;
    expect(splits.map((m) => m.mile)).toEqual([1, 2, 3]);
    expect(splits[0].distance_m).toBeCloseTo(METERS_PER_MILE, 0);
    expect(splits[2].distance_m).toBeLessThan(METERS_PER_MILE);
    // The splits' time adds up to the run's.
    const total = splits.reduce((sum, m) => sum + m.duration_s, 0);
    expect(total).toBeCloseTo(row.series!.t.at(-1)!, -1);
    expect(splits[0].avg_hr).toBeGreaterThan(100);
  });

  it("totals Garmin's split summaries by type", () => {
    const run = row.interval_splits!.find((s) => s.type === "RWD_RUN")!;
    expect(run.count).toBe(8);
    expect(run.avg_hr).toBeGreaterThan(100);
  });

  it("leaves out mile splits when asked to (rides, swims)", () => {
    expect(buildActivityDetailRow(fixture("activity-details.json"), null, { withMileSplits: false }).mile_splits).toBeNull();
  });

  it("copes with no details at all", () => {
    expect(buildActivityDetailRow(null, null, { withMileSplits: true })).toEqual({
      location_name: null,
      workout_feel: null,
      workout_rpe: null,
      min_hr: null,
      stamina_start: null,
      stamina_end: null,
      series: null,
      mile_splits: null,
      interval_splits: null,
    });
  });
});

describe("readSamples and thinSeries", () => {
  it("falls back to timestamps without a timer column, and drops metrics never recorded", () => {
    const samples = readSamples(
      details({
        directTimestamp: [1000, 2000, 3000],
        directHeartRate: [100, 110, null],
        directPower: [null, null, null],
      }),
    )!;
    expect(samples.t).toEqual([0, 1, 2]);
    expect(samples.cols.hr).toEqual([100, 110, null]);
    expect(samples.cols.power).toBeUndefined();
  });

  it("averages each bucket, but keeps the last distance and position", () => {
    const series = thinSeries(
      readSamples(
        details({
          sumDuration: [1, 2, 3, 4],
          sumDistance: [3, 6, 9, 12],
          directHeartRate: [100, 120, 140, null],
        }),
      )!,
      2,
    );
    expect(series).toEqual({ t: [2, 4], d: [6, 12], hr: [110, 140] });
  });
});

describe("mileSplits", () => {
  it("interpolates the moment each mile is crossed", () => {
    // Steady 2 m/s for 1.5 miles, sampled every 100 s.
    const t = Array.from({ length: 14 }, (_, i) => i * 100);
    const d = t.map((s) => Math.min(s * 2, 1.5 * METERS_PER_MILE));
    const splits = mileSplits(readSamples(details({ sumDuration: t, sumDistance: d }))!)!;
    expect(splits).toHaveLength(2);
    expect(splits[0].duration_s).toBeCloseTo(METERS_PER_MILE / 2, 0);
    expect(splits[1].distance_m).toBeCloseTo(METERS_PER_MILE / 2, 0);
  });

  it("ignores elevation noise smaller than a couple of meters, but counts a real climb", () => {
    const t = Array.from({ length: 41 }, (_, i) => i * 10);
    const d = t.map((s) => s * 2); // 800 m: one partial "mile" of 0.5
    const flat = t.map((_, i) => 20 + (i % 2 ? 0.8 : -0.8));
    const climb = t.map((_, i) => 20 + i * 0.5); // +20 m, steadily
    const [noisy] = mileSplits(readSamples(details({ sumDuration: t, sumDistance: d, directElevation: flat }))!)!;
    const [hill] = mileSplits(readSamples(details({ sumDuration: t, sumDistance: d, directElevation: climb }))!)!;
    expect(noisy.elevation_gain_m).toBe(0);
    expect(hill.elevation_gain_m).toBeCloseTo(20, 0);
  });

  it("is null without distance", () => {
    expect(mileSplits(readSamples(details({ sumDuration: [0, 1], directHeartRate: [90, 95] }))!)).toBeNull();
  });
});

// Keep the record type exercised so a rename in details.ts breaks here too.
export type _Record = RawActivityRecord;
