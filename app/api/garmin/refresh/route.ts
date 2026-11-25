import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { GarminError } from "@/lib/garmin/client";
import { importGarmin } from "@/lib/garmin/import";

export const maxDuration = 60;

/**
 * The "Refresh" button (components/dashboard/garmin-refresh-button.tsx): imports today and
 * yesterday from the Garmin Personal API, in this request, and the page reloads with the fresh
 * rows. The nightly cron (app/api/garmin/cron/route.ts) covers the days before.
 */
export async function POST() {
  if ((await getRole()) !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can refresh." }, { status: 403 });
  }
  try {
    // Today and yesterday, so the button also rescues a workout that synced after last night's run.
    const result = await importGarmin({ window: { kind: "days", days: 2 } });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Garmin refresh failed:", err);
    const message = err instanceof GarminError ? err.message : "Couldn’t refresh from Garmin.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
