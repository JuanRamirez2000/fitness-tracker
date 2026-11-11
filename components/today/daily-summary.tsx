import { SummaryWriting } from "@/components/dashboard/summary-status";
import type { DashboardData } from "@/lib/dashboard/types";
import type { NextSession } from "@/lib/data/planned";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { clockTimeIn } from "@/lib/dates/timezone";

const LABEL = { today: "Daily summary", weight: "Weight summary", training: "Training summary" } as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today", "Tomorrow" or "Fri, Nov 14". */
function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return `${WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}, ${fmtDate(date)}`;
}

/** The Training summary's next sessions: Garmin Coach's plan, explained, or suggestions. */
function NextUp({ sessions, today }: { sessions: NextSession[]; today: string }) {
  const upcoming = sessions.filter((s) => s.date >= today);
  if (upcoming.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5 pt-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Next up</span>
      <ol className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {upcoming.map((s) => (
          <li key={`${s.date}-${s.title}`} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-serif text-[16px]">{s.title}</span>
              <span className="font-mono text-[10px] text-muted-2">{dayLabel(s.date, today)}</span>
            </div>
            <p className="text-[12.5px] leading-[1.5] text-muted-1">{s.details}</p>
            <span className="font-mono text-[9.5px] text-muted-2">{s.source === "garmin" ? "From your Garmin Coach plan" : "Suggested"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Today's AI-written summary for the active tab (and, on Training, the next sessions). Renders
 * nothing when none was written today, and a skeleton while the Refresh button is rewriting it. */
export function DailySummary({ data }: { data: DashboardData }) {
  return (
    <SummaryWriting label={LABEL[data.tab]}>
      {data.summary && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
            {LABEL[data.summary.tab]} · AI-written · {clockTimeIn(data.summary.generated_at, data.profile.timezone)}
          </span>
          <p className="max-w-[860px] font-serif text-[clamp(17px,2.2vw,20px)] leading-[1.5] text-pretty">{data.summary.text}</p>
          {data.summary.next_sessions && <NextUp sessions={data.summary.next_sessions} today={data.today} />}
        </div>
      )}
    </SummaryWriting>
  );
}
