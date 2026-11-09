"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RangeKey, TabKey } from "@/lib/dashboard/types";
import { loadStoredRange, loadStoredTab } from "@/lib/range/storage";
import { rangeToSearchParams, type UrlRange } from "@/lib/range/url";
import type { SportFilter } from "@/lib/sport";

/**
 * "The last-used range (and tab) is remembered in localStorage and used when the URL has
 * none." Runs once after mount: whatever the URL left out, swap in what the visitor last
 * picked, in ONE replace (two separate navigations would race and drop each other's param),
 * without adding a history entry. Renders nothing.
 */
export function StoredViewRestorer({
  range,
  rangeKey,
  tab,
  sport,
  tabExplicit,
}: {
  /** The URL's own range, or null when the server fell back to the default. */
  range: UrlRange | null;
  /** The range actually on screen (the URL's, or the default). */
  rangeKey: RangeKey;
  tab: TabKey;
  sport: SportFilter;
  tabExplicit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedRange = range ? null : loadStoredRange();
    const storedTab = tabExplicit ? null : loadStoredTab();
    const nextRange: UrlRange = range ?? { key: storedRange ?? rangeKey };
    const nextTab = storedTab ?? tab;
    if (nextRange.key === rangeKey && nextTab === tab) return;
    router.replace(`${pathname}?${rangeToSearchParams(nextRange, nextTab, sport)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);

  return null;
}
