import { NextResponse, type NextRequest } from "next/server";
import { importGarmin } from "@/lib/garmin/import";
import { generateDailySummary } from "@/lib/summary/generate";

export const maxDuration = 60;

/**
 * The morning job, called by Vercel Cron (vercel.json) after the athlete has woken: imports
 * today's sleep, recovery, weigh-in and fitness age from the Personal API (the 1 AM nightly
 * run is too early for last night's sleep), then writes the AI daily summary. Readiness comes
 * from the unofficial import, scheduled shortly before this (.github/workflows/garmin-unofficial.yml).
 *
 * Same auth as the nightly cron: Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const imported = await importGarmin({
      window: { kind: "today" },
      datasets: ["weigh-ins", "sleep", "recovery", "fitness-age"],
      log: console.log,
    });
    const summary = await generateDailySummary({ log: console.log });
    return NextResponse.json({ ok: true, imported, summary });
  } catch (err) {
    console.error("Morning summary failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
