import { ChartCard } from "@/components/charts/chart-card";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { has, type DayRow } from "@/lib/log/days";
import { SPORT_STYLE, type ActiveSport } from "@/lib/sport";

const HELP = "The month around the picked week, a day per square: a sport glyph per activity, ⚖ a weigh-in, ☾ a night of sleep, ● a mood log. Click a day to jump to its row in the table below.";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GLYPH_TONE: Record<ActiveSport, string> = { ride: "text-sport-ride", run: "text-sport-run", swim: "text-sport-swim" };

/** A month calendar with markers for what each day has. `month` is any day in it. */
export function MonthGrid({ month, days, today }: { month: LocalDate; days: DayRow[]; today: LocalDate }) {
  const first = `${month.slice(0, 7)}-01` as LocalDate;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -lead);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const title = new Date(`${first}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const rows = cells.slice(-7).every((d) => d.slice(0, 7) !== first.slice(0, 7)) ? cells.slice(0, 35) : cells;
  return (
    <ChartCard help={HELP} title={title} subtitle="What each day has: activities, weigh-ins, sleep and mood">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="px-1 font-mono text-[9.5px] text-muted-2">
            {w}
          </span>
        ))}
        {rows.map((date) => {
          const d = byDate.get(date);
          const inMonth = date.slice(0, 7) === first.slice(0, 7);
          const future = date > today;
          return (
            <a
              key={date}
              href={d ? `#day-${date}` : undefined}
              className={`flex min-h-[54px] min-w-0 flex-col gap-0.5 rounded-md border px-1.5 py-1 ${date === today ? "border-accent/60" : "border-border"} ${inMonth ? "bg-raised" : "opacity-40"} ${future ? "opacity-30" : "hover:border-border-strong"}`}
            >
              <span className="font-mono text-[10px] text-muted-2">{Number(date.slice(8))}</span>
              {d && (
                <span className="flex flex-wrap gap-x-1 text-[11px] leading-none">
                  {d.activities.map((a) =>
                    a.sport ? (
                      <span key={a.id} className={GLYPH_TONE[a.sport]} title={a.name}>
                        {SPORT_STYLE[a.sport].glyph}
                      </span>
                    ) : null,
                  )}
                  {has(d, "weight") && <span className="text-muted-1" title="Weigh-in">⚖</span>}
                  {has(d, "sleep") && <span className="text-muted-2" title="Sleep">☾</span>}
                  {has(d, "mood") && <span className="text-accent" title="Mood log">●</span>}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </ChartCard>
  );
}
