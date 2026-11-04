import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/session";
import { GarminError } from "@/lib/garmin/client";
import { importGarmin } from "@/lib/garmin/import";

export const maxDuration = 60;

/**
 * The "Refresh" button's endpoint (components/dashboard/garmin-refresh-button.tsx): imports
 * TODAY from the Garmin Personal API, in this request. The nightly cron
 * (app/api/garmin/cron/route.ts) covers yesterday.
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
