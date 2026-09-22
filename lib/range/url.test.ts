import { describe, expect, it } from "vitest";
import { parseRangeParams, rangeToSearchParams } from "./url";

describe("parseRangeParams", () => {
  it("is null with no range param at all", () => {
    expect(parseRangeParams({})).toBeNull();
  });

  it("reads a plain preset key", () => {
    expect(parseRangeParams({ range: "6m" })).toEqual({ key: "6m" });
    expect(parseRangeParams({ range: "week" })).toEqual({ key: "week" });
  });

  it("rejects a key that is not one of the six range keys", () => {
    expect(parseRangeParams({ range: "fortnight" })).toBeNull();
    expect(parseRangeParams({ range: "" })).toBeNull();
  });

  it("reads a valid custom range", () => {
    expect(parseRangeParams({ range: "custom", from: "2026-09-01", to: "2026-09-20" })).toEqual({
      key: "custom",
      custom: { from: "2026-09-01", to: "2026-09-20" },
    });
  });

  it("rejects custom with a missing or malformed from/to", () => {
    expect(parseRangeParams({ range: "custom" })).toBeNull();
    expect(parseRangeParams({ range: "custom", from: "2026-09-01" })).toBeNull();
    expect(parseRangeParams({ range: "custom", from: "2026-02-30", to: "2026-09-20" })).toBeNull();
    expect(parseRangeParams({ range: "custom", from: "not-a-date", to: "2026-09-20" })).toBeNull();
  });

  it("does not require from/to for a non-custom key even if present", () => {
    expect(parseRangeParams({ range: "week", from: "garbage" })).toEqual({ key: "week" });
  });
});

describe("rangeToSearchParams", () => {
  it("serializes a preset as just ?range=...", () => {
    expect(rangeToSearchParams({ key: "year" })).toBe("range=year");
  });

  it("serializes custom with from and to", () => {
    const qs = rangeToSearchParams({ key: "custom", custom: { from: "2026-09-01", to: "2026-09-20" } });
    expect(new URLSearchParams(qs).get("from")).toBe("2026-09-01");
    expect(new URLSearchParams(qs).get("to")).toBe("2026-09-20");
    expect(new URLSearchParams(qs).get("range")).toBe("custom");
  });

  it("round-trips through parseRangeParams", () => {
    const original = { key: "custom" as const, custom: { from: "2026-01-01", to: "2026-01-15" } };
    const qs = rangeToSearchParams(original);
    const params = Object.fromEntries(new URLSearchParams(qs));
    expect(parseRangeParams(params)).toEqual(original);
  });
});
