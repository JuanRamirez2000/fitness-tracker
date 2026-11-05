import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { GarminError } from "@/lib/garmin/client";
import { importGarmin } from "@/lib/garmin/import";
import { generateSummaries } from "@/lib/summary/generate";

// The import plus three Gemini calls, each of which may wait out a busy API (RETRY_DELAYS_MS).
export const maxDuration = 120;

/**
 * The "Refresh" button's endpoint (components/dashboard/garmin-refresh-button.tsx): imports
 * TODAY from the Garmin Personal API, then rewrites today's AI summaries from the fresh rows,
 * in this request. The nightly cron (app/api/garmin/cron/route.ts) covers yesterday.
 *
 * Three Gemini calls per press, well inside the free tier's daily quota for a couple of users.
 * A failed import writes no summaries (they'd match the stored ones); a failed summary still
 * reports the import as done, with `summaryFailed` so the button can say so.
 */
export async function POST() {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can refresh." }, { status: 403 });
  }
  let result: Awaited<ReturnType<typeof importGarmin>>;
  try {
    result = await importGarmin({ window: { kind: "today" } });
  } catch (err) {
    console.error("Garmin refresh failed:", err);
    const message = err instanceof GarminError ? err.message : "Couldn’t refresh from Garmin.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  let summaryFailed: boolean;
  try {
    const summaries = await generateSummaries({ log: console.log });
    // A tab skipped for lack of data has no model; one whose Gemini call failed does.
    summaryFailed = summaries.some((s) => s.text === null && s.model !== null);
  } catch (err) {
    console.error("Summary after refresh failed:", err);
    summaryFailed = true;
  }
  return NextResponse.json({ ok: true, result, summaryFailed });
}
