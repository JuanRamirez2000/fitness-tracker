"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchFeatureRequests,
  insertFeatureRequest,
  REQUEST_STATUSES,
  updateFeatureRequestStatus,
  type FeatureRequest,
  type RequestStatus,
} from "@/lib/data/feature-requests";
import { fmtDate } from "@/lib/dates/format";
import { localDateIn } from "@/lib/dates/timezone";
import { createClient } from "@/lib/supabase/browser";

const STATUS_STYLE: Record<RequestStatus, string> = {
  open: "text-muted-2 bg-raised border-border-strong",
  planned: "text-accent bg-accent/10 border-accent/25",
  done: "text-good bg-good/10 border-good/25",
  dismissed: "text-bad bg-bad/10 border-bad/25",
};

/**
 * Frame 2E "Ideas queue": a compose box plus every request either account has filed, both
 * readable by the owner and the coach (the "read all" RLS policy — only two trusted accounts
 * exist) and either can retriage any request's status ("update any" — same parity the rest of
 * the app gives the coach). Data loads lazily on open rather than through DashboardData, so
 * this stays a self-contained, drop-in header widget like QuickLogLauncher.
 */
export function FeatureRequestsPanel({
  currentUserId,
  authors,
  timezone,
}: {
  currentUserId: string;
  authors: Record<string, string>;
  /** The viewer's own timezone, to render each request's created_at as a real local_date
   * rather than slicing its UTC string — the same rule every other date in this app follows
   * (see lib/dates/timezone.ts). */
  timezone: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FeatureRequest[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || requests !== null) return;
    let cancelled = false;
    fetchFeatureRequests(supabase)
      .then((rows) => {
        if (!cancelled) setRequests(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requests, supabase]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const created = await insertFeatureRequest(supabase, currentUserId, { body: trimmed });
      setRequests((current) => [created, ...(current ?? [])]);
      setBody("");
    } catch {
      // The compose box keeps its text so nothing typed is lost; try Send again.
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(id: string, status: RequestStatus) {
    const previous = requests;
    setRequests((current) => (current ?? []).map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await updateFeatureRequestStatus(supabase, id, status);
    } catch {
      setRequests(previous);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border-strong px-3 py-[7px] text-[12.5px] text-muted-1"
      >
        Ideas
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ideas queue"
          className="absolute right-0 top-full z-20 mt-2 flex w-[min(352px,calc(100vw-40px))] flex-col overflow-hidden rounded-[14px] border border-border-strong bg-card shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between border-b border-divider px-[18px] py-3.5">
            <span className="font-serif text-[16px]">Ideas queue</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[14px] text-muted-2">
              {"×"}
            </button>
          </div>

          <div className="flex flex-col gap-2.5 border-b border-divider px-[18px] py-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Something to add later…"
              rows={2}
              className="min-h-[52px] resize-none rounded-[9px] border border-field-border bg-inset px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || body.trim() === ""}
              className="self-end rounded-lg bg-accent px-4 py-2 text-[12.5px] font-medium text-bg disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>

          <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto px-[18px] py-3.5">
            {requests === null && !loadError && <p className="py-4 text-center text-[12px] text-muted-2">{"Loading…"}</p>}
            {loadError && <p className="py-4 text-center text-[12px] text-bad">Could not load requests.</p>}
            {requests?.length === 0 && <p className="py-4 text-center text-[12px] text-muted-2">No requests yet.</p>}
            {requests?.map((r) => (
              <div key={r.id} className="flex items-start gap-2.5">
                <select
                  value={r.status}
                  onChange={(e) => changeStatus(r.id, e.target.value as RequestStatus)}
                  className={`mt-px shrink-0 rounded-[5px] border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.07em] ${STATUS_STYLE[r.status]}`}
                >
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12.5px] leading-[1.4] text-ink">{r.body}</span>
                  <span className="font-mono text-[9.5px] text-muted-2">
                    {(authors[r.author_id] ?? "Someone") + " · " + fmtDate(localDateIn(r.created_at, timezone))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
