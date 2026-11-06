import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { GarminError } from "@/lib/garmin/client";
import { importGarmin } from "@/lib/garmin/import";

export const maxDuration = 60;

/**
 * Step one of the "Refresh" button (components/dashboard/garmin-refresh-button.tsx): imports
 * TODAY from the Garmin Personal API, in this request. The nightly cron
 * (app/api/garmin/cron/route.ts) covers yesterday.
 *
 * The page reloads with the fresh rows as soon as this answers. Only after a successful
 * import does the button ask /api/summary/refresh to rewrite today's AI summaries, so the new
 * numbers never wait on Gemini.
 */
export async function POST() {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can refresh." }, { status: 403 });
  }
  try {
    const result = await importGarmin({ window: { kind: "today" } });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Garmin refresh failed:", err);
    const message = err instanceof GarminError ? err.message : "Couldn’t refresh from Garmin.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
