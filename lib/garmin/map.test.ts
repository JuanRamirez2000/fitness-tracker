import { describe, expect, it } from "vitest";
import { jwtExpiryMs, parseTokenResponse } from "./client";
import { resolveWindow } from "./import";
import { buildActivityRows, buildStepsRows, buildWeighInRows } from "./map";

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
      },
    ]);
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
