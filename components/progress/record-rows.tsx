"use client";

import { openActivity } from "@/components/activity/open";
import { SportBadge } from "@/components/ui/sport-badge";
import { fmtDate } from "@/lib/dates/format";
import type { RecordEvent } from "@/lib/progress/records";

/** The records as rows, newest first; one set in an activity opens it on click. */
export function RecordRows({ records }: { records: RecordEvent[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {records.map((r) => {
        const body = (
          <>
            <span className="w-[52px] shrink-0 font-mono text-[10px] text-muted-2">{fmtDate(r.date)}</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              {r.sport && <SportBadge sport={r.sport} />}
              <span className="text-[12.5px] text-ink">{r.title}</span>
              <span className="font-mono text-[10px] text-muted-2">{r.kind === "milestone" ? "milestone" : "record"}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="font-mono text-[13px] text-ink">{r.value}</span>
              {r.previous && <span className="font-mono text-[9.5px] text-muted-2">{r.previous}</span>}
            </span>
          </>
        );
        const frame = "flex w-full items-center gap-3 py-2 text-left";
        return (
          <li key={r.key}>
            {r.activityId ? (
              <button type="button" onClick={() => openActivity(r.activityId!)} className={`${frame} hover:bg-raised`} aria-label={`${r.title}, ${r.value}. Open the activity.`}>
                {body}
              </button>
            ) : (
              <div className={frame}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
