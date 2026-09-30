import { AppHeader } from "@/components/app-header";
import { ChartsSection } from "@/components/charts/charts-section";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { WeighInTable } from "@/components/dashboard/weigh-in-table";
import { HeatmapCard } from "@/components/heatmap/heatmap-card";
import { getRole } from "@/lib/auth/session";
import { loadDashboardData } from "@/lib/dashboard/load";
import { fetchOwnerProfile } from "@/lib/data/queries";
import { parseRangeParams } from "@/lib/range/url";

// "The last-used range is remembered in localStorage and used when the URL has none.
// Default: month." (RangeControl applies the localStorage part client-side after mount.)
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
  const data = await loadDashboardData(profile, {
    rangeKey: parsedRange?.key ?? DEFAULT_RANGE_KEY,
    custom: parsedRange?.custom,
  });

  return (
    <>
      <AppHeader data={data} canEdit={canEdit} rangeExplicit={parsedRange !== null} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-6 pb-16 md:px-8">
        <KpiCards data={data} />
        <HeatmapCard data={data} />
        <ChartsSection data={data} />
        <WeighInTable rows={data.weighIns} today={data.today} canEdit={canEdit} />
      </main>
    </>
  );
}
