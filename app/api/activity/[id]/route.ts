import { NextResponse, type NextRequest } from "next/server";
import { loadActivityView } from "@/lib/activity/load";
import { getRole } from "@/lib/auth/session";
import { fetchOwnerProfile } from "@/lib/data/queries";

// Two Garmin requests when an old activity is opened for the first time.
export const maxDuration = 30;

/**
 * The activity modal's data (components/activity/activity-modal.tsx): GET /api/activity/<id>.
 * Anyone who can see the dashboard can read it; only the owner's request fetches missing
 * detail from Garmin.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/activity/[id]">) {
  const { id } = await ctx.params;
  const profile = await fetchOwnerProfile();
  if (!profile) return NextResponse.json({ error: "No profile yet." }, { status: 404 });
  const view = await loadActivityView(profile, id, { fetchMissing: (await getRole()) === "owner" });
  if (!view) return NextResponse.json({ error: "No such activity." }, { status: 404 });
  return NextResponse.json(view);
}
