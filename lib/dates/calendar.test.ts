import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayStartUtcMs,
  diffDays,
  eachDay,
  isLocalDate,
  startOfWeek,
  weekdayOf,
} from "./calendar";

describe("validation", () => {
  it("accepts real dates, including a leap day", () => {
    expect(isLocalDate("2026-09-20")).toBe(true);
    expect(isLocalDate("2028-02-29")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-9-2", "nope", ""]) {
      expect(isLocalDate(bad), bad).toBe(false);
    }
    expect(() => dayStartUtcMs("2026-02-30")).toThrow();
  });
});

describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("is unaffected by daylight-saving changes", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
  });
});

describe("addMonths", () => {
  it("keeps the day of month when the target month has it", () => {
    expect(addMonths("2026-09-20", -6)).toBe("2026-03-20");
    expect(addMonths("2026-09-20", -12)).toBe("2025-09-20");
  });

  it("clamps to the end of a shorter month", () => {
    expect(addMonths("2026-08-31", -6)).toBe("2026-02-28");
    expect(addMonths("2028-08-31", -6)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("maps a leap day onto the last day of February", () => {
    expect(addMonths("2028-02-29", -12)).toBe("2027-02-28");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
  });

  it("crosses year boundaries in both directions", () => {
    expect(addMonths("2026-01-15", -6)).toBe("2025-07-15");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-01-15", -13)).toBe("2024-12-15");
  });
});

describe("diffDays", () => {
  it("counts whole days, signed", () => {
    expect(diffDays("2026-09-20", "2026-09-17")).toBe(3);
    expect(diffDays("2026-09-17", "2026-09-20")).toBe(-3);
    expect(diffDays("2026-09-20", "2026-09-20")).toBe(0);
  });

  it("counts across a leap day and a year", () => {
    expect(diffDays("2028-03-01", "2028-02-28")).toBe(2);
    expect(diffDays("2027-01-01", "2026-01-01")).toBe(365);
    expect(diffDays("2029-01-01", "2028-01-01")).toBe(366);
  });
});

describe("weekdays", () => {
  it("numbers Sunday as 0 like profiles.shot_weekday", () => {
    expect(weekdayOf("2026-09-20")).toBe(0);
    expect(weekdayOf("2026-09-17")).toBe(4);
  });

  it("finds the Sunday that starts a week", () => {
    expect(startOfWeek("2026-09-17")).toBe("2026-09-13");
    expect(startOfWeek("2026-09-13")).toBe("2026-09-13");
    expect(startOfWeek("2026-09-19")).toBe("2026-09-13");
  });
});

describe("eachDay", () => {
  it("is inclusive on both ends", () => {
    expect(eachDay("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("returns one day for a single-day window and none for a reversed one", () => {
    expect(eachDay("2026-09-20", "2026-09-20")).toEqual(["2026-09-20"]);
    expect(eachDay("2026-09-20", "2026-09-19")).toEqual([]);
  });
});
