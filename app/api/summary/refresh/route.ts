import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { generateSummaries, type SummaryTab } from "@/lib/summary/generate";
import { writeWeeklySummary } from "@/lib/summary/weekly";

// Up to two Gemini calls side by side, each of which may wait out a busy API (RETRY_DELAYS_MS).
export const maxDuration = 60;

/**
 * Step two of the "Refresh" button (components/dashboard/garmin-refresh-button.tsx), sent
 * after /api/garmin/refresh imported today, scoped to the tab it was pressed on:
 * `?scope=training` rewrites the Training summary and the weekly review (this week so far; on
 * Monday, last week's final one), `?scope=weight` the Weight summary, `?scope=weekly` only the
 * review; no scope, every tab summary. Scoped because the free tier allows about 20 Gemini calls
 * a day, and the morning run already spends three or four. `summaryFailed` says a Gemini call
 * failed, so the button can say so.
 */
export async function POST(request?: Request) {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can rewrite summaries." }, { status: 403 });
  }
  const scope = request ? new URL(request.url).searchParams.get("scope") : null;
  try {
    const weekly = scope === "weekly" || scope === "training";
    const tabs: SummaryTab[] | undefined = scope === "training" || scope === "weight" ? [scope] : scope === "weekly" ? [] : undefined;
    const [review, summaries] = await Promise.all([
      weekly ? writeWeeklySummary({ log: console.log }) : null,
      tabs?.length === 0 ? [] : generateSummaries({ log: console.log, tabs }),
    ]);
    // Skipped for lack of data has no model; a failed Gemini call does.
    const reviewFailed = review !== null && review.headline === null && review.model !== null;
    return NextResponse.json({ ok: true, summaryFailed: reviewFailed || summaries.some((s) => s.text === null && s.model !== null) });
  } catch (err) {
    console.error("Summary refresh failed:", err);
    return NextResponse.json({ ok: true, summaryFailed: true });
  }
}
