import { Suspense } from "react";
import { ActivityModal } from "@/components/activity/activity-modal";
import { AppHeader } from "@/components/app-header";
import { TabSkeleton } from "@/components/dashboard/skeletons";
import { NavStatusProvider, TabBodyFrame } from "@/components/dashboard/nav-status";
import { StoredViewRestorer } from "@/components/dashboard/stored-view-restorer";
import { SummaryStatusProvider } from "@/components/dashboard/summary-status";
import { TodayTab } from "@/components/tabs/today-tab";
import { TrainingTab } from "@/components/tabs/training-tab";
import { WeightTab } from "@/components/tabs/weight-tab";
import { getRole } from "@/lib/auth/session";
import { loadDashboardData, resolveShell } from "@/lib/dashboard/load";
import { DEFAULT_TAB, type DashboardData } from "@/lib/dashboard/types";
import { fetchOwnerProfileAndFirstWeight } from "@/lib/data/queries";
import { parseRangeParams, parseTabParam, type UrlRange } from "@/lib/range/url";
import { parseSportParam } from "@/lib/sport";

// "The last-used range is remembered in localStorage and used when the URL has none.
// Default: month." The same goes for the tab (default: Daily feel). StoredViewRestorer
// applies the localStorage part client-side after mount.
const DEFAULT_RANGE_KEY = "month" as const;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Two database round trips: the profile (with the first weigh-in, for the range) renders the
 * header, then every query the tab needs goes out at once and streams into the tab's skeleton.
 * On a tab or range click the client shows feedback first (components/dashboard/nav-status.tsx).
 */
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  // Anyone can view; only a browser that unlocked editing with OWNER_PASSWORD can change data.
  const [role, owner, rawParams] = await Promise.all([getRole(), fetchOwnerProfileAndFirstWeight(), searchParams]);
  const canEdit = role === "owner";
  if (!owner) {
    return (
      <main className="flex flex-1 items-center justify-center px-5 text-sm text-muted-2">
        No profile yet. Run `npm run db:import` (see README).
      </main>
    );
  }

  const parsedRange = parseRangeParams({
    range: firstOf(rawParams.range),
    from: firstOf(rawParams.from),
    to: firstOf(rawParams.to),
  });
  const parsedTab = parseTabParam(firstOf(rawParams.tab));
  const shell = resolveShell(owner.profile, owner.firstWeighIn, {
    rangeKey: parsedRange?.key ?? DEFAULT_RANGE_KEY,
    custom: parsedRange?.custom,
    tab: parsedTab ?? DEFAULT_TAB,
    sport: parseSportParam(firstOf(rawParams.sport)),
  });
  // Started here, awaited inside the Suspense below, so the header doesn't wait on it.
  const data = loadDashboardData(shell);

  return (
    <NavStatusProvider>
      <SummaryStatusProvider>
        <StoredViewRestorer
          range={parsedRange}
          rangeKey={shell.dateRange.key}
          tab={shell.tab}
          sport={shell.sport}
          tabExplicit={parsedTab !== null}
        />
        <AppHeader data={shell} canEdit={canEdit} urlRange={parsedRange} />
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-12 px-4 pt-8 pb-20 md:px-8 md:pt-9">
          <TabBodyFrame current={shell.tab}>
            <Suspense fallback={<TabSkeleton tab={shell.tab} />}>
              <TabBody data={data} canEdit={canEdit} urlRange={parsedRange} />
            </Suspense>
          </TabBodyFrame>
        </main>
        {/* Reads ?activity= on the client (useSearchParams), so opening one needs no server render. */}
        <Suspense fallback={null}>
          <ActivityModal timezone={owner.profile.timezone} />
        </Suspense>
      </SummaryStatusProvider>
    </NavStatusProvider>
  );
}

async function TabBody({ data: pending, canEdit, urlRange }: { data: Promise<DashboardData>; canEdit: boolean; urlRange: UrlRange | null }) {
  const data = await pending;
  return (
    <>
      {data.tab === "today" && <TodayTab data={data} />}
      {data.tab === "weight" && <WeightTab data={data} canEdit={canEdit} />}
      {data.tab === "training" && <TrainingTab data={data} urlRange={urlRange} />}
    </>
  );
}
