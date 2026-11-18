import { describe, expect, it } from "vitest";
import { parseRangeParams, parseTabParam, rangeToSearchParams, tabToSearchParams } from "./url";

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

describe("parseTabParam", () => {
  it("reads each known tab", () => {
    expect(parseTabParam("today")).toBe("recovery");
    expect(parseTabParam("progress")).toBe("home");
    expect(parseTabParam("home")).toBe("home");
    expect(parseTabParam("log")).toBe("log");
    expect(parseTabParam("weight")).toBe("weight");
    expect(parseTabParam("training")).toBe("training");
  });

  it("is null for a missing or unknown tab, so the caller falls back", () => {
    expect(parseTabParam(undefined)).toBeNull();
    expect(parseTabParam("")).toBeNull();
    expect(parseTabParam("sleep")).toBeNull();
  });
});

describe("rangeToSearchParams with a tab", () => {
  it("keeps a non-default tab when the range changes", () => {
    expect(rangeToSearchParams({ key: "year" }, "weight")).toBe("range=year&tab=weight");
  });

  it("leaves the default tab out, and keeps a picked week on any tab", () => {
    expect(rangeToSearchParams({ key: "year" }, "home")).toBe("range=year");
    expect(rangeToSearchParams({ key: "year" }, "weight", "all", "2026-11-09")).toBe("range=year&tab=weight&week=2026-11-09");
  });
});

describe("tabToSearchParams", () => {
  it("keeps an explicit range, custom dates included", () => {
    const qs = new URLSearchParams(
      tabToSearchParams("weight", { key: "custom", custom: { from: "2026-09-01", to: "2026-09-20" } }),
    );
    expect(Object.fromEntries(qs)).toEqual({ range: "custom", from: "2026-09-01", to: "2026-09-20", tab: "weight" });
  });

  it("names only the tab when the URL had no range", () => {
    expect(tabToSearchParams("training", null)).toBe("tab=training");
  });

  it("always names the tab, even the default, so the link is explicit", () => {
    expect(tabToSearchParams("training", { key: "week" })).toBe("range=week&tab=training");
  });
});
