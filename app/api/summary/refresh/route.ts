import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { generateSummaries } from "@/lib/summary/generate";

// Three Gemini calls side by side, each of which may wait out a busy API (RETRY_DELAYS_MS).
export const maxDuration = 60;

/**
 * Step two of the "Refresh" button (components/dashboard/garmin-refresh-button.tsx), sent
 * after /api/garmin/refresh imported today: rewrites today's three tab summaries from the
 * fresh rows. Three Gemini calls per press, well inside the free tier's daily quota for a
 * couple of users. `summaryFailed` says a tab's Gemini call failed, so the button can say so.
 */
export async function POST() {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can rewrite summaries." }, { status: 403 });
  }
  try {
    const summaries = await generateSummaries({ log: console.log });
    // A tab skipped for lack of data has no model; one whose Gemini call failed does.
    const summaryFailed = summaries.some((s) => s.text === null && s.model !== null);
    return NextResponse.json({ ok: true, summaryFailed });
  } catch (err) {
    console.error("Summary refresh failed:", err);
    return NextResponse.json({ ok: true, summaryFailed: true });
  }
}
