import { describe, expect, it } from "vitest";
import { fmtDistance, planSteps } from "./plan-steps";
import type { Block } from "./types";

const CTX = { ftpW: 220, hrZones: [[101, 120], [121, 140], [141, 160], [161, 180], [181, 200]] as [number, number][], pool: { length: 25, unit: "yard" as const } };

describe("planSteps", () => {
  it("reads Runna's steps as Garmin sent them: pace ranges per mile, distances, notes", () => {
    // scripts/garmin/test_import_unofficial.py RUNNA_TEMPO, through compact_step.
    const steps = [
      { kind: "warmup", end: "lap.button", note: "OWU: 0.75mi warm up" },
      { kind: "interval", end: "distance", value: 804.67, target: "pace.zone", lo: 2.3494015, hi: 2.1601879 },
      { kind: "rest", end: "time", value: 90.0 },
      { kind: "cooldown", end: "distance", value: 1207.005 },
    ];
    expect(planSteps({ source: "garmin", steps }, CTX)).toEqual([
      { kind: "step", label: "Warm up", length: "until lap", target: null, note: "OWU: 0.75mi warm up" },
      { kind: "step", label: "Work", length: "0.5 mi", target: "11:25–12:25 /mi", note: null },
      { kind: "step", label: "Rest", length: "1:30", target: null, note: null },
      { kind: "step", label: "Cool down", length: "0.75 mi", target: null, note: null },
    ]);
  });

  it("keeps repeats together, with HR zones read against the athlete's own bounds", () => {
    const steps = [{ repeat: 4, steps: [{ kind: "interval", end: "time", value: 180, target: "heart.rate.zone", zone: 4 }, { kind: "recovery", end: "time", value: 120 }] }];
    expect(planSteps({ source: "garmin", steps }, CTX)).toEqual([
      {
        kind: "repeat",
        times: 4,
        steps: [
          { kind: "step", label: "Work", length: "3 min", target: "Zone 4 · 161–180 bpm", note: null },
          { kind: "step", label: "Recover", length: "2 min", target: null, note: null },
        ],
      },
    ]);
  });

  it("describes the tracker's own workouts with the builder's labels", () => {
    const blocks: Block[] = [
      { kind: "warmup", length: { by: "time", seconds: 600 }, target: { by: "hr", zone: 2 }, note: "Easy spin" },
      { kind: "repeat", times: 3, steps: [{ kind: "work", length: { by: "time", seconds: 600 }, target: { by: "power", low: 0.88, high: 0.93 } }] },
    ];
    const rows = planSteps({ source: "self", steps: blocks }, CTX);
    expect(rows[0]).toEqual({ kind: "step", label: "Warm up", length: "10 min", target: "Zone 2 · 121–140 bpm", note: "Easy spin" });
    expect(rows[1]).toMatchObject({ kind: "repeat", times: 3, steps: [{ label: "Work", target: "195–205 W" }] });
  });

  it("is empty without stored steps", () => {
    expect(planSteps({ source: "garmin", steps: null }, CTX)).toEqual([]);
  });
});

describe("fmtDistance", () => {
  it("keeps metric track reps in meters and the rest in miles", () => {
    expect(fmtDistance(400)).toBe("400 m");
    expect(fmtDistance(402.336)).toBe("0.25 mi");
    expect(fmtDistance(4828)).toBe("3 mi");
  });
});
