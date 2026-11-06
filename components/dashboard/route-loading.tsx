"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_TAB } from "@/lib/dashboard/types";
import { parseTabParam } from "@/lib/range/url";
import { HeaderSkeleton, TabSkeleton } from "./skeletons";

/**
 * app/loading.tsx's body. On a tab click the router already knows the destination URL, so the
 * skeleton can highlight the tab being opened and take that tab's shape right away.
 */
export function RouteLoading() {
  const tab = parseTabParam(useSearchParams().get("tab") ?? undefined) ?? DEFAULT_TAB;
  return (
    <>
      <HeaderSkeleton tab={tab} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-12 px-4 pt-8 pb-20 md:px-8 md:pt-9">
        <TabSkeleton tab={tab} />
      </main>
    </>
  );
}
