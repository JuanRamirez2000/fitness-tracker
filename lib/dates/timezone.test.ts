import { describe, expect, it } from "vitest";
import { eachDay } from "./calendar";
import { defaultMeasuredAt, instantAt, localDateIn, todayIn } from "./timezone";

const LA = "America/Los_Angeles";

describe("localDateIn", () => {
  it("does not use the UTC date: 8pm in Los Angeles is still the same local day", () => {
    // 03:00Z on Sep 21 is 20:00 PDT on Sep 20.
    expect(localDateIn("2026-09-21T03:00:00Z", LA)).toBe("2026-09-20");
    expect(new Date("2026-09-21T03:00:00Z").toISOString().slice(0, 10)).toBe("2026-09-21");
  });

  it("rolls over exactly at local midnight in summer time (UTC-7)", () => {
    expect(localDateIn("2026-09-21T06:59:59Z", LA)).toBe("2026-09-20");
    expect(localDateIn("2026-09-21T07:00:00Z", LA)).toBe("2026-09-21");
  });

  it("rolls over exactly at local midnight in winter time (UTC-8)", () => {
    expect(localDateIn("2026-01-15T07:59:59Z", LA)).toBe("2026-01-14");
    expect(localDateIn("2026-01-15T08:00:00Z", LA)).toBe("2026-01-15");
  });

  describe("spring forward (Los Angeles, Sun Mar 8 2026, 02:00 PST becomes 03:00 PDT)", () => {
    it("moves the midnight before the change", () => {
      expect(localDateIn("2026-03-08T07:59:59Z", LA)).toBe("2026-03-07");
      expect(localDateIn("2026-03-08T08:00:00Z", LA)).toBe("2026-03-08");
    });

    it("keeps the instants either side of the skipped hour on the same day", () => {
      expect(localDateIn("2026-03-08T09:59:59Z", LA)).toBe("2026-03-08");
      expect(localDateIn("2026-03-08T10:00:00Z", LA)).toBe("2026-03-08");
    });

    it("moves the midnight after the change", () => {
      expect(localDateIn("2026-03-09T06:59:59Z", LA)).toBe("2026-03-08");
      expect(localDateIn("2026-03-09T07:00:00Z", LA)).toBe("2026-03-09");
    });
  });

  describe("fall back (Los Angeles, Sun Nov 1 2026, 02:00 PDT becomes 01:00 PST)", () => {
    it("moves the midnight before the change", () => {
      expect(localDateIn("2026-11-01T06:59:59Z", LA)).toBe("2026-10-31");
      expect(localDateIn("2026-11-01T07:00:00Z", LA)).toBe("2026-11-01");
    });

    it("keeps both passes through the repeated 01:30 on the same day", () => {
      expect(localDateIn("2026-11-01T08:30:00Z", LA)).toBe("2026-11-01"); // 01:30 PDT
      expect(localDateIn("2026-11-01T09:30:00Z", LA)).toBe("2026-11-01"); // 01:30 PST
    });

    it("moves the midnight after the change, 25 hours later", () => {
      expect(localDateIn("2026-11-02T07:59:59Z", LA)).toBe("2026-11-01");
      expect(localDateIn("2026-11-02T08:00:00Z", LA)).toBe("2026-11-02");
    });
  });

  it("handles a 23-hour day where the clocks lead UTC (Auckland, Sep 27 2026)", () => {
    expect(localDateIn("2026-09-26T11:59:59Z", "Pacific/Auckland")).toBe("2026-09-26");
    expect(localDateIn("2026-09-26T12:00:00Z", "Pacific/Auckland")).toBe("2026-09-27");
    expect(localDateIn("2026-09-27T10:59:59Z", "Pacific/Auckland")).toBe("2026-09-27");
    expect(localDateIn("2026-09-27T11:00:00Z", "Pacific/Auckland")).toBe("2026-09-28");
  });

  it("handles a half-hour offset (Kolkata)", () => {
    expect(localDateIn("2026-09-20T18:29:59Z", "Asia/Kolkata")).toBe("2026-09-20");
    expect(localDateIn("2026-09-20T18:30:00Z", "Asia/Kolkata")).toBe("2026-09-21");
  });

  it("reads Supabase timestamptz strings, including microseconds and offsets", () => {
    expect(localDateIn("2026-09-21T03:00:00.123456+00:00", LA)).toBe("2026-09-20");
    expect(localDateIn("2026-09-20T22:00:00-07:00", LA)).toBe("2026-09-20");
    expect(localDateIn("2026-09-21T09:00:00+02:00", LA)).toBe("2026-09-21");
  });

  it("throws on a bad timestamp or time zone rather than guessing a day", () => {
    expect(() => localDateIn("not a date", LA)).toThrow();
    expect(() => localDateIn("2026-09-20T00:00:00Z", "Not/AZone")).toThrow();
  });
});

describe("todayIn", () => {
  it("is the local day at the supplied instant", () => {
    expect(todayIn(LA, new Date("2026-09-21T03:00:00Z"))).toBe("2026-09-20");
    expect(todayIn("Asia/Kolkata", new Date("2026-09-21T03:00:00Z"))).toBe("2026-09-21");
  });
});

describe("instantAt", () => {
  it("applies the offset in force on that day", () => {
    expect(instantAt("2026-09-20", 7, 0, LA).toISOString()).toBe("2026-09-20T14:00:00.000Z");
    expect(instantAt("2026-01-15", 7, 0, LA).toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });

  it("switches offset across the spring-forward and fall-back days", () => {
    expect(instantAt("2026-03-07", 7, 0, LA).toISOString()).toBe("2026-03-07T15:00:00.000Z");
    expect(instantAt("2026-03-08", 7, 0, LA).toISOString()).toBe("2026-03-08T14:00:00.000Z");
    expect(instantAt("2026-10-31", 7, 0, LA).toISOString()).toBe("2026-10-31T14:00:00.000Z");
    expect(instantAt("2026-11-01", 7, 0, LA).toISOString()).toBe("2026-11-01T15:00:00.000Z");
  });

  it("round-trips to the same local day and clock time all year, near midnight and at 07:00", () => {
    const days = eachDay("2026-01-01", "2026-12-31");
    for (const timeZone of [LA, "Pacific/Auckland", "Asia/Kolkata", "Europe/London"]) {
      for (const [hour, minute] of [[0, 30], [7, 0], [23, 30]]) {
        for (const day of days) {
          const instant = instantAt(day, hour, minute, timeZone);
          expect(localDateIn(instant, timeZone), `${timeZone} ${day} ${hour}:${minute}`).toBe(day);
        }
      }
    }
  });
});

describe("defaultMeasuredAt", () => {
  it("lands on the target local date even when that date is not today", () => {
    // "Now" is 2026-09-20 14:00 PDT; backfilling a weigh-in for 2026-09-15.
    const now = new Date("2026-09-20T21:00:00Z");
    const instant = defaultMeasuredAt("2026-09-15", LA, now);
    expect(localDateIn(instant, LA)).toBe("2026-09-15");
  });

  it("carries today's clock time onto the backfilled date", () => {
    const now = new Date("2026-09-20T21:07:00Z"); // 14:07 PDT
    const instant = defaultMeasuredAt("2026-09-10", LA, now);
    expect(instant.toISOString()).toBe(instantAt("2026-09-10", 14, 7, LA).toISOString());
  });

  it("matches 'now' exactly (to the minute) when the target date is today", () => {
    const now = new Date("2026-09-20T21:07:00Z");
    const instant = defaultMeasuredAt("2026-09-20", LA, now);
    expect(Math.abs(instant.getTime() - now.getTime())).toBeLessThan(60_000);
  });
});
