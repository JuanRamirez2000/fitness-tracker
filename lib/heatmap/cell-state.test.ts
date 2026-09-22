import { describe, expect, it } from "vitest";
import { cellDateState, isInRange } from "./cell-state";

describe("cellDateState", () => {
  const programStart = "2026-09-17";
  const today = "2026-09-20";

  it("is pre_program strictly before the program start", () => {
    expect(cellDateState("2026-09-16", programStart, today)).toBe("pre_program");
  });

  it("is in_program on the program start and on today, inclusive", () => {
    expect(cellDateState(programStart, programStart, today)).toBe("in_program");
    expect(cellDateState(today, programStart, today)).toBe("in_program");
    expect(cellDateState("2026-09-18", programStart, today)).toBe("in_program");
  });

  it("is future strictly after today", () => {
    expect(cellDateState("2026-09-21", programStart, today)).toBe("future");
  });

  it("prefers future over pre_program when the program has not started yet", () => {
    expect(cellDateState("2026-10-05", "2026-10-01", today)).toBe("future");
  });
});

describe("isInRange", () => {
  const range = { from: "2026-09-01", to: "2026-09-20" };

  it("includes both endpoints", () => {
    expect(isInRange("2026-09-01", range)).toBe(true);
    expect(isInRange("2026-09-20", range)).toBe(true);
  });

  it("excludes days on either side", () => {
    expect(isInRange("2026-08-31", range)).toBe(false);
    expect(isInRange("2026-09-21", range)).toBe(false);
  });
});
