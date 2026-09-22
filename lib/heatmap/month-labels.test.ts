import { describe, expect, it } from "vitest";
import { monthLabels } from "./month-labels";
import { heatmapWindow } from "./window";

describe("monthLabels", () => {
  it("labels the first week and every week after that starts a new month", () => {
    const window = heatmapWindow("2026-09-17", "2026-09-20");
    const labels = monthLabels(window);
    expect(labels[0]).toEqual({ column: 0, label: "Sep" });
    // window.from is 2026-09-13 (Sunday); the next month label is the week whose Sunday is
    // in October, i.e. week index 3 (2026-10-04).
    expect(labels[1]).toEqual({ column: 3, label: "Oct" });
  });

  it("never emits two labels for the same month back to back", () => {
    const labels = monthLabels(heatmapWindow("2026-09-17", "2027-09-18"));
    for (let i = 1; i < labels.length; i++) expect(labels[i].label).not.toBe(labels[i - 1].label);
  });

  it("covers a run of 53 weeks with columns in range and increasing", () => {
    const labels = monthLabels(heatmapWindow("2026-09-17", "2026-09-20"));
    expect(labels.length).toBeGreaterThan(10); // roughly 12-13 months across 53 weeks
    for (const l of labels) expect(l.column).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < labels.length; i++) expect(labels[i].column).toBeGreaterThan(labels[i - 1].column);
  });
});
