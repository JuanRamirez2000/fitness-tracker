import { NextResponse, type NextRequest } from "next/server";
import { importGarmin } from "@/lib/garmin/import";

export const maxDuration = 60;

/**
 * Nightly Garmin import, called by Vercel Cron (schedule in vercel.json). Imports the last
 * three days in the athlete's timezone, so the exact run time doesn't matter as long as it's
 * after local midnight, and an activity that syncs a day or two late is still caught.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set on the project;
 * without it this route refuses every caller.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    // Three days (today, yesterday, the day before), not just yesterday: a watch that syncs to
    // Garmin Connect late (phone out of range, app closed) would otherwise miss the one run that
    // looks at its day. Upserts are idempotent and details are only fetched for new activities.
    const result = await importGarmin({ window: { kind: "days", days: 3 }, log: console.log });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Garmin nightly import failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
