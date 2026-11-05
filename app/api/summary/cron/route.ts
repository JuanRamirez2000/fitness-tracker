import { NextResponse, type NextRequest } from "next/server";
import { writeMissingActivitySummaries } from "@/lib/activity/summary";
import { fetchOwnerProfile } from "@/lib/data/queries";
import { addDays } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { importGarmin } from "@/lib/garmin/import";
import { generateSummaries } from "@/lib/summary/generate";

// Three tab summaries plus one per new activity, each of which may wait out a busy Gemini.
export const maxDuration = 180;

/**
 * The morning job, called by Vercel Cron (vercel.json) after the athlete has woken: imports
 * today's sleep, recovery, weigh-in and fitness age from the Personal API (the 1 AM nightly
 * run is too early for last night's sleep), then writes the AI summaries, one per tab, and one for each of yesterday's and today's activities. Readiness comes
 * from the unofficial import, scheduled shortly before this (.github/workflows/garmin-unofficial.yml).
 *
 * Same auth as the nightly cron: Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  // A failed import (Garmin rate-limiting, say) still leaves the summaries to write from what's
  // already stored: the Weight and Training tabs don't need this morning's rows.
  let imported: Awaited<ReturnType<typeof importGarmin>> | { error: string };
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
  try {
    const summaries = await generateSummaries({ log: console.log });
    // Then each activity from yesterday and today without one (the nightly import brought in
    // yesterday's, detail included). A failure here doesn't undo the tab summaries.
    let activitySummaries: { written: number; failed: number } | { error: string } = { written: 0, failed: 0 };
    const profile = await fetchOwnerProfile();
    if (profile) {
      const today = todayIn(profile.timezone);
      try {
        activitySummaries = await writeMissingActivitySummaries(profile, { from: addDays(today, -1), to: today }, { log: console.log });
      } catch (err) {
        console.error("Activity summaries failed:", err);
        activitySummaries = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    return NextResponse.json({ ok: !("error" in imported), imported, summaries, activitySummaries });
  } catch (err) {
    console.error("Morning summary failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
