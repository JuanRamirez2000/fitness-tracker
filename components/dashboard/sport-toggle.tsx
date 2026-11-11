"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { sportToSearchParams, type UrlRange } from "@/lib/range/url";
import { SPORT_LABELS, type ActiveSport, type SportFilter } from "@/lib/sport";

/**
 * The Training tab's All | Ride | Run (| Swim) switch: All, then every sport with at least one
 * activity (`sports`). Plain links (`?sport=`), like the tab row, so each sport is a server
 * render that works without JS; the clicked one lights up at once.
 */
export function SportToggle({ current, range, sports }: { current: SportFilter; range: UrlRange | null; sports: readonly ActiveSport[] }) {
  const pathname = usePathname();
  // The clicked sport, and the sport on screen when it was clicked: once the server render for
  // it arrives, `current` moves on and the optimistic highlight no longer applies.
  const [pending, setPending] = useState<{ sport: SportFilter; from: SportFilter } | null>(null);
  const shown = pending && pending.from === current ? pending.sport : current;

  return (
    <nav aria-label="Sport" className="flex w-fit gap-0.5 rounded-lg border border-field-border bg-inset p-[3px]">
      {(["all", ...sports, ...(current !== "all" && !sports.includes(current) ? [current] : [])] as SportFilter[]).map((sport) => {
        const on = sport === shown;
        return (
          <Link
            key={sport}
            href={`${pathname}?${sportToSearchParams(sport, range)}`}
            scroll={false}
            aria-current={on ? "page" : undefined}
            onClick={() => sport !== current && setPending({ sport, from: current })}
            className={`flex min-h-9 items-center whitespace-nowrap rounded-md px-3.5 font-mono text-[11px] transition-colors ${
              on ? "bg-accent text-bg" : "text-muted-2 hover:text-ink"
            }`}
          >
            {SPORT_LABELS[sport]}
          </Link>
        );
      })}
    </nav>
  );
}
