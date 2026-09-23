import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ChartsSection } from "@/components/charts/charts-section";
import { HeatmapCard } from "@/components/heatmap/heatmap-card";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { DataTableSection } from "@/components/dashboard/data-table-section";
import { getViewer } from "@/lib/auth/viewer";
import { loadDashboardData } from "@/lib/dashboard/load";
import { parseRangeParams } from "@/lib/range/url";
import { isLoginSkipped } from "@/lib/supabase/dev-login";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/supabase/session";

// "The last-used range is remembered in localStorage and used when the URL has none.
// Default: month." (RangeControl applies the localStorage part client-side after mount.)
const DEFAULT_RANGE_KEY = "month" as const;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const viewer = await getViewer();
  // proxy.ts already routes signed-out visitors to /login; this narrows the type and only
  // lets a missing viewer through while the temporary dev login skip is on.
  if (!viewer && !isLoginSkipped()) redirect(LOGIN_PATH);

  const rawParams = await searchParams;
  const parsedRange = parseRangeParams({
    range: firstOf(rawParams.range),
    from: firstOf(rawParams.from),
    to: firstOf(rawParams.to),
  });

  const data = viewer?.athlete
    ? await loadDashboardData(await createClient(), viewer.athlete, {
        rangeKey: parsedRange?.key ?? DEFAULT_RANGE_KEY,
        custom: parsedRange?.custom,
      })
    : null;

  return (
    <>
      <AppHeader
        viewer={viewer}
        range={data?.dateRange ?? null}
        rangeExplicit={parsedRange !== null}
        today={data?.today ?? null}
        quickLog={
          data
            ? {
                userId: data.profile.id,
                timezone: data.profile.timezone,
                today: data.today,
                activityTypes: data.activityTypes,
                stepsGoal: data.profile.steps_goal,
              }
            : null
        }
      />
      <main className="flex flex-1 flex-col gap-6 px-5 pt-6 pb-24 md:px-10 md:py-7">
        {data ? (
          <>
            <KpiGrid data={data} />
            <HeatmapCard data={data} />
            <ChartsSection data={data} />
            <DataTableSection data={data} />
          </>
        ) : (
          <p className="text-sm text-muted-2">
            {viewer ? "No athlete linked yet." : "Sign in to see the dashboard."}
          </p>
        )}
      </main>
    </>
  );
}
