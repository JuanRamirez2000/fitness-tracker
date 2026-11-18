import { Suspense } from "react";
import { RouteLoading } from "@/components/dashboard/route-loading";
import { HeaderSkeleton, TabSkeleton } from "@/components/dashboard/skeletons";
import { DEFAULT_TAB } from "@/lib/dashboard/types";

/** Next's route-level loading state, shown from the click until the page's first query (the
 * profile) is back. A skeleton of the real layout in the destination tab's shape, rather than
 * a spinner, so the page doesn't jump in structure once data arrives. From then on the header
 * is real and the tab body has its own skeleton (app/page.tsx). */
export default function DashboardLoading() {
  return (
    <Suspense
      fallback={
        <>
          <HeaderSkeleton tab={DEFAULT_TAB} />
          <div className="mx-auto flex w-full max-w-[1200px] flex-1 gap-10 px-4 md:px-8 xl:max-w-[1460px]">
            <aside className="hidden w-[210px] shrink-0 xl:block" />
            <main className="flex min-w-0 flex-1 flex-col gap-12 pt-8 pb-20 md:pt-9">
              <TabSkeleton tab={DEFAULT_TAB} />
            </main>
          </div>
        </>
      }
    >
      <RouteLoading />
    </Suspense>
  );
}
