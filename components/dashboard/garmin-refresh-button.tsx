"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "loading" | "error" | "pending";

/**
 * Sits right next to "+ Log today" (frame 2A's header, extended past the design — no frame
 * covers this). Pulls today only from Garmin via /api/garmin/refresh, on demand — the
 * nightly GitHub Actions job (.github/workflows/garmin-nightly.yml) already covers
 * yesterday every night, so this exists for "I just logged a run/weighed in and want it to
 * show up now" rather than waiting. The route dispatches and polls that same GH Actions
 * workflow (mode=today) rather than running anything in this process, so this can easily
 * take 20-30s — the loading state stays up the whole time, not just for the initial request.
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
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (body.ok) {
        setStatus("idle");
        router.refresh();
        return;
      }
      setStatus(res.status === 202 ? "pending" : "error");
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
      {status === "pending" && (
        <span className="text-[11px] text-warn">{message ?? "Still running…"}</span>
      )}
    </div>
  );
}
