import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRole } from "@/lib/auth/session";
import { fetchOwnerProfile } from "@/lib/data/queries";
import { fetchPushStatuses } from "@/lib/workouts/store";

/**
 * Push status of the tracker's own workouts (`?ids=uuid,uuid`), polled by the planner card while
 * one is being sent to or removed from the Garmin calendar. A uuid missing from the answer has
 * been removed.
 */
export async function GET(request: NextRequest) {
  if ((await getRole()) !== "owner") return NextResponse.json({ error: "Only the owner can see this." }, { status: 403 });
  const ids = z.array(z.uuid()).max(50).safeParse((request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean));
  if (!ids.success) return NextResponse.json({ error: "Bad ids." }, { status: 400 });
  const profile = await fetchOwnerProfile();
  if (!profile) return NextResponse.json({ error: "No profile." }, { status: 404 });
  return NextResponse.json({ workouts: await fetchPushStatuses(profile.id, ids.data) });
}
