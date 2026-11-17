"use client";

import { openActivity } from "@/components/activity/open";

interface Metric {
  /** "+1:42", seconds per mile. */
  value: string;
  detail: string;
  tone: "slower" | "faster";
}

/** One brick, display-ready (components/charts/brick-card.tsx). */
export interface BrickRowView {
  runId: string;
  date: string;
  legs: string;
  transition: string;
  cost: Metric | null;
  drop: Metric | null;
}

function MetricCell({ label, metric, empty }: { label: string; metric: Metric | null; empty: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{label}</span>
      {metric ? (
        <>
          <span className="font-mono text-[16px] leading-tight text-ink">
            {metric.value}
            <span className="text-[11px] text-muted-2"> /mi {metric.tone}</span>
          </span>
          <span className="font-mono text-[10px] text-muted-2">{metric.detail}</span>
        </>
      ) : (
        <span className="font-mono text-[10px] text-muted-3">{empty}</span>
      )}
    </span>
  );
}

/** Newest first; each row opens its run. */
export function BrickRows({ rows }: { rows: BrickRowView[] }) {
  return (
    <ul className="flex flex-col divide-y divide-divider/60">
      {rows.map((r) => (
        <li key={r.runId} className="py-2.5 first:pt-0 last:pb-0">
          <button
            type="button"
            onClick={() => openActivity(r.runId)}
            className="grid w-full grid-cols-1 gap-x-6 gap-y-2 text-left sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]"
            aria-label={`Brick on ${r.date}: ${r.legs}. Open the run.`}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">{r.date}</span>
              <span className="truncate text-[13px] text-ink">{r.legs}</span>
              <span className="font-mono text-[10px] text-muted-2">{r.transition}</span>
            </span>
            <MetricCell label="Off-bike cost" metric={r.cost} empty="too few fresh runs at this heart rate" />
            <MetricCell label="Opening vs rest" metric={r.drop} empty="no splits for this run yet" />
          </button>
        </li>
      ))}
    </ul>
  );
}
