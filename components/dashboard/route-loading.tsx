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
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 gap-10 px-4 md:px-8 xl:max-w-[1460px]">
        <aside className="hidden w-[210px] shrink-0 xl:block" />
        <main className="flex min-w-0 flex-1 flex-col gap-12 pt-8 pb-20 md:pt-9">
          <TabSkeleton tab={tab} />
        </main>
      </div>
    </>
  );
}
