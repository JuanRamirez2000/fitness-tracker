import { isLocalDate } from "@/lib/dates/calendar";
import { DEFAULT_TAB, RANGE_KEYS, TAB_KEYS, type RangeKey, type TabKey } from "@/lib/dashboard/types";

export interface UrlRange {
  key: RangeKey;
  /** Only set (and only meaningful) when key === "custom". */
  custom?: { from: string; to: string };
}

/** Query params as Next.js hands them to a page (each value a string or absent). */
export interface RangeSearchParams {
  range?: string;
  from?: string;
  to?: string;
}

/** Reads `?tab=...`, or null when it's missing or not one of TAB_KEYS (the caller then falls
 * back to localStorage, then to DEFAULT_TAB). Never throws. */
export function parseTabParam(tab: string | undefined): TabKey | null {
  return tab && (TAB_KEYS as readonly string[]).includes(tab) ? (tab as TabKey) : null;
}

/**
 * Reads `?range=...` (and `&from=...&to=...` for custom) into a validated UrlRange, or null
 * if the URL has no usable range at all — the caller then falls back to localStorage, then
 * to the documented default ("month"). Never throws: a malformed URL just falls back too,
 * the same as a missing one, rather than crashing the page.
 */
export function parseRangeParams(params: RangeSearchParams): UrlRange | null {
  const key = params.range;
  if (!key || !(RANGE_KEYS as readonly string[]).includes(key)) return null;

  if (key === "custom") {
    const { from, to } = params;
    if (!from || !to || !isLocalDate(from) || !isLocalDate(to)) return null;
    return { key: "custom", custom: { from, to } };
  }
  return { key: key as RangeKey };
}

/** The query string RangeControl pushes when the user picks a range (no leading "?"). A tab
 * other than the default rides along, so changing the range never changes the tab. */
export function rangeToSearchParams(range: UrlRange, tab: TabKey = DEFAULT_TAB): string {
  const params = new URLSearchParams({ range: range.key });
  if (range.key === "custom" && range.custom) {
    params.set("from", range.custom.from);
    params.set("to", range.custom.to);
  }
  if (tab !== DEFAULT_TAB) params.set("tab", tab);
  return params.toString();
}

/**
 * The query string for a tab link. The range rides along only when the URL already named one
 * (`range` non-null): on a bare URL the range is still "whatever localStorage says", and
 * pinning the server's fallback here would override it.
 */
export function tabToSearchParams(tab: TabKey, range: UrlRange | null): string {
  const params = new URLSearchParams(range ? rangeToSearchParams(range) : "");
  params.set("tab", tab);
  return params.toString();
}
