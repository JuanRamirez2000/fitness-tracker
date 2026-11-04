import { RANGE_KEYS, TAB_KEYS, type RangeKey, type TabKey } from "@/lib/dashboard/types";

const STORAGE_KEY = "tracker.range";
const TAB_STORAGE_KEY = "tracker.tab";

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

/** The last tab the visitor opened, applied only when the URL names none. Same guards as
 * loadStoredRange. */
export function loadStoredTab(): TabKey | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(TAB_STORAGE_KEY);
    return value && (TAB_KEYS as readonly string[]).includes(value) ? (value as TabKey) : null;
  } catch {
    return null;
  }
}

export function storeTab(tab: TabKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Blocked storage: the tab still works for this visit via the URL.
  }
}
