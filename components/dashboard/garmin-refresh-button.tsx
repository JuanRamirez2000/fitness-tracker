"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sits right next to "+ Log today" (frame 2A's header, extended past the design — no frame
 * covers this). Pulls today only from Garmin via /api/garmin/refresh, on demand — the
 * nightly GitHub Actions job (.github/workflows/garmin-nightly.yml) already covers
 * yesterday every night, so this exists for "I just logged a run/weighed in and want it to
 * show up now" rather than waiting.
 */
export function GarminRefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function refresh() {
    setState("loading");
    try {
      const res = await fetch("/api/garmin/refresh", { method: "POST" });
      if (!res.ok) throw new Error();
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={state === "loading"}
        aria-label="Refresh today's data from Garmin"
        className="rounded-lg border border-border-strong px-3 py-[7px] text-[12.5px] text-muted-1 disabled:opacity-50"
      >
        {state === "loading" ? "Refreshing…" : "↻ Refresh"}
      </button>
      {state === "error" && <span className="text-[11px] text-bad">Couldn&rsquo;t refresh</span>}
    </div>
  );
}
