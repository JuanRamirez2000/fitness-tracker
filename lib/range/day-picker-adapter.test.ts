import { describe, expect, it } from "vitest";
import { jsDateToLocalDate, localDateToJsDate } from "./day-picker-adapter";

describe("day-picker date adapter", () => {
  it("round-trips a plain date", () => {
    expect(jsDateToLocalDate(localDateToJsDate("2026-09-20"))).toBe("2026-09-20");
  });

  it("round-trips the first and last day of a month, and a leap day", () => {
    for (const date of ["2026-01-01", "2026-12-31", "2028-02-29"]) {
      expect(jsDateToLocalDate(localDateToJsDate(date))).toBe(date);
    }
  });

  it("builds a Date whose local fields match the string's digits exactly", () => {
    const d = localDateToJsDate("2026-03-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 5]);
  });

  it("pads single-digit months and days back to two digits", () => {
    expect(jsDateToLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
