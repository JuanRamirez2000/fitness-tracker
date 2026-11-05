"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "loading" | "error";

/**
 * Sits right next to "+ Log today" (frame 2A's header, extended past the design — no frame
 * covers this). Pulls today only from Garmin via /api/garmin/refresh, on demand — the
 * nightly cron already covers yesterday, so this exists for "I just logged a run/weighed in
 * and want it to show up now" rather than waiting. The route imports in-request from the
 * Garmin Personal API and then rewrites today's AI summaries, so it takes several seconds.
 */
export function GarminRefreshButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/garmin/refresh", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; error?: string; summaryFailed?: boolean };
      if (body.ok) {
        setStatus("idle");
        setMessage(body.summaryFailed ? "Summary didn’t update" : null);
        router.refresh();
        return;
      }
      setStatus("error");
      setMessage(body.error ?? null);
    } catch {
      setStatus("error");
      setMessage(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={status === "loading"}
        aria-label="Refresh today's data from Garmin"
        className="rounded-lg border border-border-strong px-3 py-[7px] text-[12.5px] text-muted-1 disabled:opacity-50"
      >
        {status === "loading" ? "Refreshing…" : "↻ Refresh"}
      </button>
      {status === "error" && (
        <span className="text-[11px] text-bad">{message ?? "Couldn’t refresh"}</span>
      )}
      {status === "idle" && message && <span className="text-[11px] text-muted-1">{message}</span>}
    </div>
  );
}
