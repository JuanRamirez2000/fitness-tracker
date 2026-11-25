"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "importing" | "error";

/**
 * Pulls today only from Garmin, on demand: the nightly cron already covers yesterday, so this
 * exists for "I just logged a run or weighed in and want it to show up now" rather than waiting.
 * /api/garmin/refresh imports today, then the page reloads with it.
 */
export function GarminRefreshButton({ onBusyChange, stacked = false }: { onBusyChange?: (busy: boolean) => void; stacked?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();

  async function refresh() {
    setStatus("importing");
    setMessage(null);
    try {
      const res = await fetch("/api/garmin/refresh", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!body.ok) {
        setStatus("error");
        setMessage(body.error ?? null);
        return;
      }
    } catch {
      setStatus("error");
      setMessage(null);
      return;
    }
    // One transition: the button stays busy until the reloaded page is in.
    startTransition(() => {
      router.refresh();
      setStatus("idle");
    });
  }

  const busy = status === "importing" || refreshing;
  // The phone menu's ⋯ button shows a running refresh while the menu is closed.
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  return (
    <div className={stacked ? "flex flex-col items-stretch gap-1.5" : "flex items-center gap-2"}>
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        aria-label="Refresh today's data from Garmin"
        className="rounded-lg border border-border-strong px-3 py-[7px] text-[12.5px] text-muted-1 disabled:opacity-50"
      >
        {busy ? "Refreshing…" : "↻ Refresh"}
      </button>
      {status === "error" && <span className="text-[11px] text-bad">{message ?? "Couldn’t refresh"}</span>}
    </div>
  );
}
