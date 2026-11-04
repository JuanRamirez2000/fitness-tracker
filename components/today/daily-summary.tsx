import type { DashboardData } from "@/lib/dashboard/types";
import { clockTimeIn } from "@/lib/dates/timezone";

/** Today's AI-written summary over the hero. Renders nothing when none was written today. */
export function DailySummary({ data }: { data: DashboardData }) {
  if (!data.summary) return null;
  return (
    <div className="flex max-w-[860px] flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
        Daily summary · AI-written · {clockTimeIn(data.summary.generated_at, data.profile.timezone)}
      </span>
      <p className="font-serif text-[clamp(17px,2.2vw,20px)] leading-[1.5] text-pretty">{data.summary.text}</p>
    </div>
  );
}
