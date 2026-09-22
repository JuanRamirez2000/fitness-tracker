import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { HeatmapCard } from "@/components/heatmap/heatmap-card";
import { getViewer } from "@/lib/auth/viewer";
import { loadDashboardData } from "@/lib/dashboard/load";
import { isLoginSkipped } from "@/lib/supabase/dev-login";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/supabase/session";

// The last-used range belongs in the URL and localStorage (build step 6); "month" is the
// documented default until that control exists.
const DEFAULT_RANGE_KEY = "month" as const;

export default async function DashboardPage() {
  const viewer = await getViewer();
  // proxy.ts already routes signed-out visitors to /login; this narrows the type and only
  // lets a missing viewer through while the temporary dev login skip is on.
  if (!viewer && !isLoginSkipped()) redirect(LOGIN_PATH);

  const data = viewer?.athlete
    ? await loadDashboardData(await createClient(), viewer.athlete, { rangeKey: DEFAULT_RANGE_KEY })
    : null;

  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="flex flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-7">
        {data ? (
          <HeatmapCard data={data} />
        ) : (
          <p className="text-sm text-muted-2">
            {viewer ? "No athlete linked yet." : "Sign in to see the dashboard."}
          </p>
        )}
      </main>
    </>
  );
}
