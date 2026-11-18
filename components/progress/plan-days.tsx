"use client";

import { openActivity } from "@/components/activity/open";
import { SportBadge } from "@/components/ui/sport-badge";
import type { ActiveSport } from "@/lib/sport";

/** One line of a day tile, display-ready (plan-card.tsx). */
export interface PlanLine {
  key: string;
  sport: ActiveSport | null;
  title: string;
  /** "Coach · 62 min", "Extra · 32 min". */
  meta: string;
  /** The verdict ("Done · 58 min", "Missed"), with its color. */
  status: { text: string; className: string } | null;
  /** Opens this activity on click. */
  activityId: string | null;
  /** An activity that wasn't on the plan, or a planned session done another day. */
  quiet?: boolean;
}

export interface PlanDayView {
  date: string;
  heading: string;
  today: boolean;
  lines: PlanLine[];
  /** Shown when there are no lines ("Rest day", "Nothing planned"). */
  empty: string | null;
}

function Line({ line }: { line: PlanLine }) {
  const body = (
    <>
      <span className="flex flex-wrap items-center gap-1.5">{line.sport && <SportBadge sport={line.sport} />}</span>
      <span className={`text-[12.5px] leading-tight ${line.quiet ? "text-muted-1" : "text-ink"}`}>{line.title}</span>
      <span className="font-mono text-[9.5px] text-muted-2">{line.meta}</span>
      {line.status && <span className={`font-mono text-[10px] ${line.status.className}`}>{line.status.text}</span>}
    </>
  );
  const frame = `flex flex-col gap-0.5 rounded-md px-1.5 py-1 text-left ${line.quiet ? "border border-dashed border-border-strong" : ""}`;
  return line.activityId ? (
    <button type="button" onClick={() => openActivity(line.activityId!)} className={`${frame} -mx-0 hover:bg-card`} aria-label={`${line.title}. Open the activity.`}>
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}

/** Monday to Sunday: what was planned, what happened, and what was done off-plan. Seven tiles
 * across from a tablet up, a list on a phone; an activity opens on click. */
export function PlanDays({ days }: { days: PlanDayView[] }) {
  return (
    <ol className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((d) => (
        <li key={d.date} className={`flex min-w-0 flex-col gap-1.5 rounded-lg border bg-raised px-1.5 py-2 ${d.today ? "border-accent/50" : "border-border"}`}>
          <span className={`px-1.5 font-mono text-[10px] ${d.today ? "text-accent" : "text-muted-2"}`}>{d.heading}</span>
          {d.lines.map((l) => (
            <Line key={l.key} line={l} />
          ))}
          {d.empty && <span className="px-1.5 text-[12px] text-muted-3">{d.empty}</span>}
        </li>
      ))}
    </ol>
  );
}
