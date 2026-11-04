"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAB_KEYS, TAB_LABELS, type TabKey } from "@/lib/dashboard/types";
import { storeTab } from "@/lib/range/storage";
import { tabToSearchParams, type UrlRange } from "@/lib/range/url";

/**
 * The tab row under the header. Plain links (`?tab=`), so each tab is a server render of only
 * its own data, works without JS, and can be opened in a new tab. Scrolls sideways on a phone
 * rather than wrapping; each tab is at least 44px tall.
 */
export function TabRow({ current, range }: { current: TabKey; range: UrlRange | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard sections" className="-mb-px flex gap-[clamp(18px,4vw,36px)] overflow-x-auto">
      {TAB_KEYS.map((tab) => {
        const on = tab === current;
        return (
          <Link
            key={tab}
            href={`${pathname}?${tabToSearchParams(tab, range)}`}
            aria-current={on ? "page" : undefined}
            onClick={() => storeTab(tab)}
            className={`flex min-h-11 shrink-0 items-center border-b-2 pt-1 font-serif text-[18px] whitespace-nowrap transition-colors ${
              on ? "border-accent text-ink" : "border-transparent text-muted-2 hover:text-ink"
            }`}
          >
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
