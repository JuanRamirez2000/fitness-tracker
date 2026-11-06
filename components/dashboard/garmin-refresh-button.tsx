"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSummaryStatus } from "./summary-status";

type Status = "idle" | "importing" | "writing" | "error";

/**
 * Sits right next to "+ Log today" (frame 2A's header, extended past the design — no frame
 * covers this). Pulls today only from Garmin, on demand — the nightly cron already covers
 * yesterday, so this exists for "I just logged a run/weighed in and want it to show up now"
 * rather than waiting.
 *
 * Two steps, so the new numbers never wait on Gemini: /api/garmin/refresh imports today and
 * the page reloads with it; then /api/summary/refresh rewrites today's AI summaries (the
 * summary shows a skeleton meanwhile, via SummaryStatus) and the page reloads again.
 */
export function GarminRefreshButton() {
  const router = useRouter();
  const { setWriting } = useSummaryStatus();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

    router.refresh();
    setStatus("writing");
    setWriting(true);
    let summaryFailed = true;
    try {
      const res = await fetch("/api/summary/refresh", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; summaryFailed?: boolean };
      summaryFailed = !body.ok || body.summaryFailed === true;
    } catch {
      // Network trouble: the data is in, only the summary is stale.
    }
    // One transition: the skeleton gives way only once the reloaded page carries the new
    // summary, never to the old one in between.
    startTransition(() => {
      router.refresh();
      setWriting(false);
      setStatus("idle");
      setMessage(summaryFailed ? "Summary didn’t update" : null);
    });
  }

  const busy = status === "importing" || status === "writing";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        aria-label="Refresh today's data from Garmin"
        className="rounded-lg border border-border-strong px-3 py-[7px] text-[12.5px] text-muted-1 disabled:opacity-50"
      >
        {status === "importing" ? "Refreshing…" : status === "writing" ? "Writing summary…" : "↻ Refresh"}
      </button>
      {status === "error" && (
        <span className="text-[11px] text-bad">{message ?? "Couldn’t refresh"}</span>
      )}
      {status === "idle" && message && <span className="text-[11px] text-muted-1">{message}</span>}
    </div>
  );
}
