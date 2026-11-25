import { NextResponse, type NextRequest } from "next/server";
import { writeMissingActivitySummaries } from "@/lib/activity/summary";
import { fetchOwnerProfile, fetchRecovery } from "@/lib/data/queries";
import { addDays } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { importGarmin } from "@/lib/garmin/import";

// One summary per new activity, each of which may wait out a busy Gemini.
export const maxDuration = 180;

/**
 * The morning job: imports today's sleep, recovery, weigh-in and fitness age from the Personal
 * API (the 1 AM nightly run is too early for last night's sleep), then writes the AI summary for
 * each of yesterday's and today's activities that has none. The dashboard has no daily or
 * weekly AI summaries any more (docs/plan-four-tabs.md).
 *
 * Two callers:
 * - `?after=import`: the morning run of .github/workflows/garmin-unofficial.yml, once its
 *   readiness import is done.
 * - No query: Vercel Cron (vercel.json), later in the morning, as the fallback for a day the
 *   GitHub run never called. It skips the import when this morning's readiness is already in,
 *   and only ever writes missing activity summaries, so a normal day spends no extra Garmin or
 *   Gemini calls.
 *
 * Same auth as the nightly cron: `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const profile = await fetchOwnerProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "No profile." }, { status: 500 });
  const today = todayIn(profile.timezone);
  const fallback = new URL(request.url).searchParams.get("after") !== "import";

  // A failed import (Garmin rate-limiting, say) still leaves the activity summaries to write.
  let imported: Awaited<ReturnType<typeof importGarmin>> | { error: string } | { skipped: string };
  if (fallback && (await hasMorningReadiness(profile.id, today))) {
    imported = { skipped: "This morning's readiness is already in." };
  } else {
    try {
      imported = await importGarmin({
        window: { kind: "today" },
        datasets: ["weigh-ins", "sleep", "recovery", "fitness-age"],
        log: console.log,
      });
    } catch (err) {
      console.error("Morning import failed:", err);
      imported = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Each activity from yesterday and today without one (the nightly import brought in
  // yesterday's, detail included).
  let activitySummaries: { written: number; failed: number } | { error: string };
  try {
    activitySummaries = await writeMissingActivitySummaries(profile, { from: addDays(today, -1), to: today }, { log: console.log });
  } catch (err) {
    console.error("Activity summaries failed:", err);
    activitySummaries = { error: err instanceof Error ? err.message : String(err) };
  }
  return NextResponse.json({ ok: !("error" in imported) && !("error" in activitySummaries), imported, activitySummaries });
}

/** Whether today's daily_recovery row already carries a readiness score. */
async function hasMorningReadiness(userId: string, today: string): Promise<boolean> {
  const [row] = await fetchRecovery(userId, { from: today, to: today });
  return row !== undefined && (row.readiness_morning_score ?? row.readiness_score) !== null;
}
