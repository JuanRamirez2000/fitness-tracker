import { isLocalDate } from "@/lib/dates/calendar";
import { DEFAULT_TAB, RANGE_KEYS, toTabKey, type RangeKey, type TabKey } from "@/lib/dashboard/types";
import { DEFAULT_SPORT, type SportFilter } from "@/lib/sport";

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
  return toTabKey(tab);
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
 * other than the default, and a picked week, ride along, so changing the range never changes
 * them. (`sport` stays for old links; no tab filters by sport any more.) */
export function rangeToSearchParams(range: UrlRange, tab: TabKey = DEFAULT_TAB, sport: SportFilter = DEFAULT_SPORT, week: string | null = null): string {
  const params = new URLSearchParams({ range: range.key });
  if (range.key === "custom" && range.custom) {
    params.set("from", range.custom.from);
    params.set("to", range.custom.to);
  }
  if (tab !== DEFAULT_TAB) params.set("tab", tab);
  if (tab === "training" && sport !== DEFAULT_SPORT) params.set("sport", sport);
  if (week) params.set("week", week);
  return params.toString();
}

/**
 * The query string for a tab link. The range rides along only when the URL already named one
 * (`range` non-null): on a bare URL the range is still "whatever localStorage says", and
 * pinning the server's fallback here would override it. A picked week rides along too: one week
 * for every tab.
 */
export function tabToSearchParams(tab: TabKey, range: UrlRange | null, week: string | null = null): string {
  const params = new URLSearchParams(range ? rangeToSearchParams(range) : "");
  params.set("tab", tab);
  if (week) params.set("week", week);
  return params.toString();
}

/** The query string for the Training tab's sport toggle: the range and a picked week ride along
 * like a tab link's. */
export function sportToSearchParams(sport: SportFilter, range: UrlRange | null, week: string | null = null): string {
  const params = new URLSearchParams(range ? rangeToSearchParams(range) : "");
  params.set("tab", "training");
  if (sport !== DEFAULT_SPORT) params.set("sport", sport);
  if (week) params.set("week", week);
  return params.toString();
}

/** The query string for the header's week picker: the week's Monday (none for the current
 * week), on the same tab, with the range riding along. */
export function weekToSearchParams(week: string | null, range: UrlRange | null, tab: TabKey = DEFAULT_TAB): string {
  return tabToSearchParams(tab, range, week);
}
