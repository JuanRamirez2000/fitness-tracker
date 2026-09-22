import { RANGE_KEYS, type RangeKey } from "@/lib/dashboard/types";

const STORAGE_KEY = "tracker.range";

/**
 * The last range key the user picked (never "custom" — a saved custom window's dates would
 * go stale, so custom always falls back to the URL or the default instead). Guarded because
 * localStorage can throw (private browsing, disabled storage) or simply not exist (SSR).
 */
export function loadStoredRange(): RangeKey | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && (RANGE_KEYS as readonly string[]).includes(value) && value !== "custom"
      ? (value as RangeKey)
      : null;
  } catch {
    return null;
  }
}

export function storeRange(key: RangeKey): void {
  if (typeof window === "undefined" || key === "custom") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Storage can be full or blocked; the range still works for this visit via the URL.
  }
}
