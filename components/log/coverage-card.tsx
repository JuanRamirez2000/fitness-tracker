import { ChartCard } from "@/components/charts/chart-card";
import { fmtDate } from "@/lib/dates/format";
import { has, type DayRow, type LogKind } from "@/lib/log/days";

const HELP = "Which days have this kind of data over the last five weeks, Monday to Sunday. A filled square is a day with it; an empty one is a gap.";
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** One kind of data over the last five weeks: a 7-wide grid of days, filled where it exists. */
export function CoverageCard({ label, kind, days }: { label: string; kind: LogKind; days: DayRow[] }) {
  const count = days.filter((d) => has(d, kind)).length;
  // Pad the front so the first row starts on a Monday.
  const lead = days.length ? (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
  return (
    <ChartCard help={HELP} title={label} subtitle={`${count} of ${days.length} days · ${days.length ? `${fmtDate(days[0].date)} – ${fmtDate(days.at(-1)!.date)}` : ""}`}>
      <div className="grid max-w-[360px] grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-center font-mono text-[9.5px] text-muted-2">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad${i}`} />
        ))}
        {days.map((d) => (
          <a
            key={d.date}
            href={`#day-${d.date}`}
            title={`${fmtDate(d.date)}: ${has(d, kind) ? "recorded" : "nothing"}`}
            className={`aspect-square rounded-[4px] border ${has(d, kind) ? "border-accent/60 bg-accent/70" : "border-border-strong bg-transparent"}`}
          />
        ))}
      </div>
    </ChartCard>
  );
}
