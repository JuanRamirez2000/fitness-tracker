import { NextResponse, type NextRequest } from "next/server";
import { writeMissingActivitySummaries } from "@/lib/activity/summary";
import { fetchDailySummary, fetchOwnerProfile } from "@/lib/data/queries";
import { addDays } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { importGarmin } from "@/lib/garmin/import";
import { generateSummaries } from "@/lib/summary/generate";
import { writeWeeklySummary, type WeeklyResult } from "@/lib/summary/weekly";

// Three tab summaries, the weekly review and one per new activity, each of which may wait out a
// busy Gemini.
export const maxDuration = 180;

/**
 * The morning job: imports today's sleep, recovery, weigh-in and fitness age from the Personal
 * API (the 1 AM nightly run is too early for last night's sleep), then writes the AI summaries,
 * one per tab, the Home tab's weekly review (the week so far; on Monday, last week's final one),
 * and one for each of yesterday's and today's activities.
 *
 * Two callers, so the summaries never go out before that morning's readiness:
 * - `?after=import`: the morning run of .github/workflows/garmin-unofficial.yml, once its
 *   readiness import is done. GitHub's schedule often starts that run 10-60 minutes late, so a
 *   fixed Vercel time could beat it.
 * - No query: Vercel Cron (vercel.json), later in the morning, as the fallback for a day the
 *   GitHub run never called. It does nothing when today's summaries are already written, so a
 *   normal day spends no extra Gemini calls.
 *
 * Same auth as the nightly cron: `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (new URL(request.url).searchParams.get("after") !== "import") {
    const owner = await fetchOwnerProfile();
    if (owner && (await fetchDailySummary(owner.id, todayIn(owner.timezone), "training"))) {
      return NextResponse.json({ ok: true, skipped: "Today's summaries are already written." });
    }
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
    // The tab summaries and the weekly review side by side; a weekly failure doesn't undo the tabs.
    const [summaries, weekly] = await Promise.all([
      generateSummaries({ log: console.log }),
      writeWeeklySummary({ log: console.log }).catch((err): WeeklyResult | { error: string } => {
        console.error("Weekly review failed:", err);
        return { error: err instanceof Error ? err.message : String(err) };
      }),
    ]);
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
    return NextResponse.json({ ok: !("error" in imported), imported, summaries, weekly, activitySummaries });
  } catch (err) {
    console.error("Morning summary failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
