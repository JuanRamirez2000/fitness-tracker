import { NextResponse, type NextRequest } from "next/server";
import { writeActivitySummary } from "@/lib/activity/summary";
import { getRole } from "@/lib/auth/session";
import { fetchActivitySummary, fetchOwnerProfile } from "@/lib/data/queries";

// One Gemini call, which may wait out a busy API (RETRY_DELAYS_MS), and possibly the detail fetch.
export const maxDuration = 60;

/**
 * Writes an activity's AI summary when the owner opens one that has none
 * (components/activity/activity-modal.tsx). Owner only, so viewers never spend the Gemini quota;
 * an existing summary is returned as is.
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/activity/[id]/summary">) {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ error: "Only the owner can write summaries." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const profile = await fetchOwnerProfile();
  if (!profile) return NextResponse.json({ error: "No profile yet." }, { status: 404 });
  const existing = await fetchActivitySummary(profile.id, id);
  if (existing) return NextResponse.json(existing);
  try {
    const result = await writeActivitySummary(profile, id, { log: console.log });
    if ("skipped" in result) return NextResponse.json({ error: `No summary: ${result.skipped}.` }, { status: 502 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Activity summary failed:", err);
    return NextResponse.json({ error: "Couldn’t write a summary right now." }, { status: 502 });
  }
}
