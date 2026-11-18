import { ChartCard } from "@/components/charts/chart-card";
import { Sparkline } from "@/components/dashboard/kpi-card";
import { SportBadge } from "@/components/ui/sport-badge";
import { fmtDate } from "@/lib/dates/format";
import { toneColor } from "@/lib/kpis/tone-color";
import type { PlanMetric, PlanProgress } from "@/lib/progress/plans";

const HELP =
  "How the training plan on your Garmin calendar is going, judged by what the plan is for. A running plan named for a race (a 10k plan) follows Garmin's predicted time for that distance, then running VO2 max and your easy-run pace scaled to 130 bpm (faster at the same heart rate means a fitter aerobic engine). A cycling plan follows FTP and cycling VO2 max. Each number is compared with where it stood when the plan began. Sessions done counts the plan's sessions whose day has come; one done within two days of its date still counts. The mileage line warns when running climbs more than about 15% on your recent weekly average.";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayName = (date: string) => WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];

function MetricTile({ m }: { m: PlanMetric }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-raised px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{m.label}</span>
      <span className="font-mono text-[20px] leading-none text-ink">{m.text}</span>
      <span className="font-mono text-[10px]" style={{ color: toneColor(m.tone) }}>
        {m.changeText}
      </span>
      {m.points.length > 1 && <Sparkline points={m.points} invert={m.better === "lower"} height={26} />}
    </div>
  );
}

function AdherenceTile({ plan }: { plan: PlanProgress }) {
  const a = plan.adherence;
  const share = a.due ? a.done / a.due : null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-raised px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">Sessions done</span>
      <span className="font-mono text-[20px] leading-none text-ink">
        {a.due ? `${a.done} of ${a.due}` : "None due yet"}
      </span>
      {a.keyDue > 0 && (
        <span className="font-mono text-[10px]" style={{ color: toneColor(a.keyDone === a.keyDue ? "good" : "warn") }}>
          {a.keyDone} of {a.keyDue} key sessions
        </span>
      )}
      {share !== null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-track" role="img" aria-label={`${Math.round(share * 100)}% of due sessions done`}>
          <div className="h-full rounded-[3px] bg-good" style={{ width: `${(share * 100).toFixed(1)}%` }} />
        </div>
      )}
      {a.missed.length > 0 && <span className="font-mono text-[10px] text-muted-2">Missed: {a.missed.join(", ")}</span>}
    </div>
  );
}

/** One plan on the Garmin calendar: where it is, whether its goal measure is moving, and how
 * much of it got done. */
export function PlanProgressCard({ plan }: { plan: PlanProgress }) {
  const title = plan.name && plan.name !== plan.who ? `${plan.who} · ${plan.name}` : plan.who;
  const subtitle = [
    plan.week && plan.weeks ? `Week ${plan.week} of ${plan.weeks}` : `Since ${fmtDate(plan.start)}`,
    plan.end ? `${fmtDate(plan.start)} to ${fmtDate(plan.end)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle} caption={<SportBadge sport={plan.sport} />}>
      {plan.elapsed !== null && (
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-track" role="img" aria-label={`${Math.round(plan.elapsed * 100)}% of the plan's weeks gone`}>
          <div className="h-full rounded-[3px] bg-accent" style={{ width: `${(plan.elapsed * 100).toFixed(1)}%` }} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {plan.metrics.map((m) => (
          <MetricTile key={m.id} m={m} />
        ))}
        <AdherenceTile plan={plan} />
      </div>
      <div className="flex flex-col gap-1 text-[12.5px]">
        {plan.next && (
          <span className="text-muted-1">
            Next: <span className="text-ink">{dayName(plan.next.date)} {plan.next.name}</span>
            {plan.next.minutes && ` · ${plan.next.minutes}`}
            {plan.next.key && <span className="text-accent"> · key session</span>}
          </span>
        )}
        {plan.ramp && (
          <span className={plan.ramp.warn ? "text-warn" : "text-muted-2"}>
            {plan.ramp.warn ? "▲ " : ""}
            {plan.ramp.text}
          </span>
        )}
      </div>
    </ChartCard>
  );
}
