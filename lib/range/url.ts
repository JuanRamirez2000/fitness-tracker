import { isLocalDate } from "@/lib/dates/calendar";
import { RANGE_KEYS, type RangeKey } from "@/lib/dashboard/types";

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

/** The query string RangeControl pushes when the user picks a range (no leading "?"). */
export function rangeToSearchParams(range: UrlRange): string {
  const params = new URLSearchParams({ range: range.key });
  if (range.key === "custom" && range.custom) {
    params.set("from", range.custom.from);
    params.set("to", range.custom.to);
  }
  return params.toString();
}
