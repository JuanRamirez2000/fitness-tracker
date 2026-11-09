"use client";

import { openActivity } from "@/components/activity/open";

/** One power record under the curve: the duration, the watts, and a click to open the ride that set it. */
export function PowerRecordButton({
  activityId,
  label,
  watts,
  perKg,
  note,
  good,
  when,
}: {
  activityId: string;
  label: string;
  watts: number;
  perKg: string | null;
  note: string;
  good: boolean;
  when: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openActivity(activityId)}
      className="flex w-full flex-col items-start gap-0.5 text-left"
      aria-label={`Best ${label}: ${watts} watts on ${when}. Open the ride.`}
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
      <span className="font-mono text-[18px] leading-tight text-ink">
        {watts}
        <span className="text-[11px] text-muted-2"> W{perKg && ` · ${perKg}`}</span>
      </span>
      <span className={`font-mono text-[10px] ${good ? "text-good" : "text-muted-2"}`}>{note}</span>
      <span className="font-mono text-[9.5px] text-muted-3">{when}</span>
    </button>
  );
}
