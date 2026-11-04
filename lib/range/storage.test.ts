import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadStoredRange, loadStoredTab, storeRange, storeTab } from "./storage";

// No jsdom in this project (vitest.config.mts runs the "node" environment), so window is
// stubbed directly with a minimal, in-memory localStorage.
function fakeWindow() {
  const store = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
}

describe("range storage", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    (globalThis as { window?: unknown }).window = fakeWindow();
  });
  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    vi.unstubAllGlobals();
  });

  it("is null with nothing stored", () => {
    expect(loadStoredRange()).toBeNull();
  });

  it("round-trips a stored preset", () => {
    storeRange("6m");
    expect(loadStoredRange()).toBe("6m");
  });

  it("never stores or returns 'custom' (its dates would go stale)", () => {
    storeRange("custom");
    expect(loadStoredRange()).toBeNull();
  });

  it("ignores a corrupted stored value", () => {
    (globalThis as { window: ReturnType<typeof fakeWindow> }).window.localStorage.setItem(
      "tracker.range",
      "not-a-real-range",
    );
    expect(loadStoredRange()).toBeNull();
  });

  it("is null (not a throw) with no window at all, e.g. during SSR", () => {
    (globalThis as { window?: unknown }).window = undefined;
    expect(loadStoredRange()).toBeNull();
    expect(() => storeRange("week")).not.toThrow();
  });

  it("is null (not a throw) when localStorage itself throws", () => {
    (globalThis as { window: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(loadStoredRange()).toBeNull();
    expect(() => storeRange("week")).not.toThrow();
  });
});

describe("tab storage", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    (globalThis as { window?: unknown }).window = fakeWindow();
  });
  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("round-trips a tab", () => {
    expect(loadStoredTab()).toBeNull();
    storeTab("training");
    expect(loadStoredTab()).toBe("training");
  });

  it("ignores an unknown stored tab", () => {
    (globalThis as { window: ReturnType<typeof fakeWindow> }).window.localStorage.setItem("tracker.tab", "sleep");
    expect(loadStoredTab()).toBeNull();
  });

  it("never throws without a window", () => {
    (globalThis as { window?: unknown }).window = undefined;
    expect(loadStoredTab()).toBeNull();
    expect(() => storeTab("weight")).not.toThrow();
  });
});
