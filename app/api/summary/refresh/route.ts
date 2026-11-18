import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { generateSummaries } from "@/lib/summary/generate";
import { writeWeeklySummary } from "@/lib/summary/weekly";

// Up to three Gemini calls side by side, each of which may wait out a busy API (RETRY_DELAYS_MS).
export const maxDuration = 60;

/**
 * Step two of the "Refresh" button (components/dashboard/garmin-refresh-button.tsx), sent
 * after /api/garmin/refresh imported today. From the Progress tab (`?scope=weekly`) it rewrites
 * only the weekly review (this week so far; on Monday, last week's final one); from any other
 * tab, today's three tab summaries. Split that way because the free tier allows about 20
 * Gemini calls a day, and the morning run already spends five or six. `summaryFailed` says a
 * Gemini call failed, so the button can say so.
 */
export async function POST(request?: Request) {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can rewrite summaries." }, { status: 403 });
  }
  const weekly = request ? new URL(request.url).searchParams.get("scope") === "weekly" : false;
  try {
    if (weekly) {
      const result = await writeWeeklySummary({ log: console.log });
      // Skipped for lack of data has no model; a failed Gemini call does.
      return NextResponse.json({ ok: true, summaryFailed: result.headline === null && result.model !== null });
    }
    const summaries = await generateSummaries({ log: console.log });
    return NextResponse.json({ ok: true, summaryFailed: summaries.some((s) => s.text === null && s.model !== null) });
  } catch (err) {
    console.error("Summary refresh failed:", err);
    return NextResponse.json({ ok: true, summaryFailed: true });
  }
}
