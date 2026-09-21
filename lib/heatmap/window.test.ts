import { describe, expect, it } from "vitest";
import { diffDays, weekdayOf } from "@/lib/dates/calendar";
import { HEATMAP_WEEKS, heatmapWindow } from "./window";

// Program starts Thursday 2026-09-17, so the first column is the week of Sunday 2026-09-13.
const START = "2026-09-17";

describe("heatmapWindow", () => {
  it("anchors to the Sunday of the week containing the program start", () => {
    expect(heatmapWindow(START, "2026-09-20").from).toBe("2026-09-13");
  });

  it("covers 53 full Sunday-to-Saturday weeks", () => {
    const w = heatmapWindow(START, "2026-09-20");
    expect(w.to).toBe("2027-09-18");
    expect(diffDays(w.to, w.from) + 1).toBe(HEATMAP_WEEKS * 7);
    expect(weekdayOf(w.from)).toBe(0);
    expect(weekdayOf(w.to)).toBe(6);
  });

  it("does not move during the first year, up to and including its last day", () => {
    const first = heatmapWindow(START, "2026-09-17");
    expect(heatmapWindow(START, "2027-03-17")).toEqual(first);
    expect(heatmapWindow(START, "2027-09-18")).toEqual(first);
  });

  it("becomes the trailing 53 weeks one day after the first year ends", () => {
    const w = heatmapWindow(START, "2027-09-19"); // the Sunday that starts week 54
    expect(w.from).toBe("2026-09-20");
    expect(w.to).toBe("2027-09-25");
  });

  it("always ends with the week that contains today once it trails", () => {
    for (const today of ["2027-12-25", "2028-02-29", "2029-06-30"]) {
      const w = heatmapWindow(START, today);
      expect(w.from <= today && today <= w.to).toBe(true);
      expect(diffDays(w.to, w.from) + 1).toBe(HEATMAP_WEEKS * 7);
      expect(weekdayOf(w.from)).toBe(0);
      expect(weekdayOf(w.to)).toBe(6);
    }
  });

  it("is the same window when the program starts on the Sunday itself", () => {
    expect(heatmapWindow("2026-09-13", "2026-09-20").from).toBe("2026-09-13");
  });
});
