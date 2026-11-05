import { Suspense } from "react";
import { ActivityModal } from "@/components/activity/activity-modal";
import { AppHeader } from "@/components/app-header";
import { StoredViewRestorer } from "@/components/dashboard/stored-view-restorer";
import { TodayTab } from "@/components/tabs/today-tab";
import { TrainingTab } from "@/components/tabs/training-tab";
import { WeightTab } from "@/components/tabs/weight-tab";
import { getRole } from "@/lib/auth/session";
import { loadDashboardData } from "@/lib/dashboard/load";
import { DEFAULT_TAB } from "@/lib/dashboard/types";
import { fetchOwnerProfile } from "@/lib/data/queries";
import { parseRangeParams, parseTabParam } from "@/lib/range/url";

// "The last-used range is remembered in localStorage and used when the URL has none.
// Default: month." The same goes for the tab (default: Daily feel). StoredViewRestorer
// applies the localStorage part client-side after mount.
const DEFAULT_RANGE_KEY = "month" as const;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  // Anyone can view; only a browser that unlocked editing with OWNER_PASSWORD can change data.
  const canEdit = (await getRole()) === "owner";

  const profile = await fetchOwnerProfile();
  if (!profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-5 text-sm text-muted-2">
        No profile yet. Run `npm run db:import` (see README).
      </main>
    );
  }

  const rawParams = await searchParams;
  const parsedRange = parseRangeParams({
    range: firstOf(rawParams.range),
    from: firstOf(rawParams.from),
    to: firstOf(rawParams.to),
  });
  const parsedTab = parseTabParam(firstOf(rawParams.tab));
  const data = await loadDashboardData(profile, {
    rangeKey: parsedRange?.key ?? DEFAULT_RANGE_KEY,
    custom: parsedRange?.custom,
    tab: parsedTab ?? DEFAULT_TAB,
  });

  return (
    <>
      <StoredViewRestorer
        range={parsedRange}
        rangeKey={data.dateRange.key}
        tab={data.tab}
        tabExplicit={parsedTab !== null}
      />
      <AppHeader data={data} canEdit={canEdit} urlRange={parsedRange} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-12 px-4 pt-8 pb-20 md:px-8 md:pt-9">
        {data.tab === "today" && <TodayTab data={data} />}
        {data.tab === "weight" && <WeightTab data={data} canEdit={canEdit} />}
        {data.tab === "training" && <TrainingTab data={data} />}
      </main>
      {/* Reads ?activity= on the client (useSearchParams), so opening one needs no server render. */}
      <Suspense fallback={null}>
        <ActivityModal />
      </Suspense>
    </>
  );
}
