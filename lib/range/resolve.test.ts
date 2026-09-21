import { describe, expect, it } from "vitest";
import { diffDays } from "@/lib/dates/calendar";
import { resolveRange } from "./resolve";

const TODAY = "2026-09-20";
const START = "2026-09-17";

describe("resolveRange presets", () => {
  it("week is the last 7 days ending today", () => {
    const r = resolveRange("week", TODAY, START);
    expect(r).toEqual({ key: "week", from: "2026-09-14", to: TODAY });
    expect(diffDays(r.to, r.from) + 1).toBe(7);
  });

  it("month is the last 30 days ending today", () => {
    const r = resolveRange("month", TODAY, START);
    expect(r).toEqual({ key: "month", from: "2026-08-22", to: TODAY });
    expect(diffDays(r.to, r.from) + 1).toBe(30);
  });

  it("6m and year go back the same day of the month", () => {
    expect(resolveRange("6m", TODAY, START)).toEqual({ key: "6m", from: "2026-03-20", to: TODAY });
    expect(resolveRange("year", TODAY, START)).toEqual({
      key: "year",
      from: "2025-09-20",
      to: TODAY,
    });
  });

  it("does not clip presets to the program start", () => {
    // Only 4 days into the program, the week still spans 7 days; the heatmap dims the rest.
    expect(resolveRange("week", TODAY, START).from).toBe("2026-09-14");
  });
});

describe("month lengths and the leap day", () => {
  it("clamps 6m and year to the end of a shorter month", () => {
    expect(resolveRange("6m", "2026-08-31", START).from).toBe("2026-02-28");
    expect(resolveRange("6m", "2028-08-31", START).from).toBe("2028-02-29");
    expect(resolveRange("6m", "2026-03-31", START).from).toBe("2025-09-30");
    expect(resolveRange("year", "2028-02-29", START).from).toBe("2027-02-28");
  });

  it("counts the leap day inside day-based windows", () => {
    expect(resolveRange("week", "2028-03-02", START).from).toBe("2028-02-25");
    expect(resolveRange("month", "2028-03-05", START).from).toBe("2028-02-05");
    expect(resolveRange("month", "2027-03-05", START).from).toBe("2027-02-04");
  });
});

describe("year boundaries", () => {
  it("reaches back into the previous year", () => {
    const today = "2026-01-03";
    expect(resolveRange("week", today, START).from).toBe("2025-12-28");
    expect(resolveRange("month", today, START).from).toBe("2025-12-05");
    expect(resolveRange("6m", today, START).from).toBe("2025-07-03");
    expect(resolveRange("year", today, START).from).toBe("2025-01-03");
  });

  it("works on the last day of the year", () => {
    expect(resolveRange("week", "2026-12-31", START)).toEqual({
      key: "week",
      from: "2026-12-25",
      to: "2026-12-31",
    });
  });
});

describe("all time", () => {
  it("runs from the program start through today", () => {
    expect(resolveRange("all", TODAY, START)).toEqual({ key: "all", from: START, to: TODAY });
  });

  it("is a single day when there is only one day of data", () => {
    expect(resolveRange("all", TODAY, TODAY)).toEqual({ key: "all", from: TODAY, to: TODAY });
  });

  it("stays valid when the program starts in the future", () => {
    expect(resolveRange("all", TODAY, "2026-10-01")).toEqual({
      key: "all",
      from: TODAY,
      to: TODAY,
    });
  });
});

describe("custom", () => {
  it("uses the picked window", () => {
    expect(resolveRange("custom", TODAY, START, { from: "2026-09-10", to: "2026-09-18" })).toEqual({
      key: "custom",
      from: "2026-09-10",
      to: "2026-09-18",
    });
  });

  it("allows a single day (from == to)", () => {
    expect(resolveRange("custom", TODAY, START, { from: "2026-09-12", to: "2026-09-12" })).toEqual({
      key: "custom",
      from: "2026-09-12",
      to: "2026-09-12",
    });
  });

  it("clamps an end date after today to today", () => {
    expect(resolveRange("custom", TODAY, START, { from: "2026-09-10", to: "2026-09-25" }).to).toBe(
      TODAY,
    );
  });

  it("collapses a window that is entirely in the future to today", () => {
    expect(resolveRange("custom", TODAY, START, { from: "2026-10-01", to: "2026-10-09" })).toEqual({
      key: "custom",
      from: TODAY,
      to: TODAY,
    });
  });

  it("puts a reversed window in order", () => {
    const r = resolveRange("custom", TODAY, START, { from: "2026-09-18", to: "2026-09-10" });
    expect([r.from, r.to]).toEqual(["2026-09-10", "2026-09-18"]);
  });

  it("does not clip the start to the program start", () => {
    expect(resolveRange("custom", TODAY, START, { from: "2026-08-01", to: TODAY }).from).toBe(
      "2026-08-01",
    );
  });

  it("refuses to guess when the window is missing or malformed", () => {
    expect(() => resolveRange("custom", TODAY, START)).toThrow();
    expect(() => resolveRange("custom", TODAY, START, { from: "2026-02-30", to: TODAY })).toThrow();
  });
});
