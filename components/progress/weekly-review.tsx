import Link from "next/link";
import { SummaryWriting } from "@/components/dashboard/summary-status";
import type { WeeklySummary } from "@/lib/data/recovery";
import { addDays } from "@/lib/dates/calendar";
import { clockTimeIn } from "@/lib/dates/timezone";
import type { ProgressWeek } from "@/lib/progress/week";
import { weekToSearchParams, type UrlRange } from "@/lib/range/url";

const LABEL = "Weekly review";

/**
 * The week's AI review (lib/summary/weekly.ts): a headline, then Wins / Watch out / Next week.
 * "So far" Tuesday to Sunday, final from the Monday after. On a Monday the new week has none
 * yet, so it points to last week's. A skeleton while Refresh rewrites it.
 */
export function WeeklyReview({ summary, week, timezone, range }: { summary: WeeklySummary | null; week: ProgressWeek; timezone: string; range: UrlRange | null }) {
  return <SummaryWriting label={LABEL}>{summary ? <Review summary={summary} timezone={timezone} /> : <Missing week={week} range={range} />}</SummaryWriting>;
}

function Review({ summary, timezone }: { summary: WeeklySummary; timezone: string }) {
  const columns = [
    { title: "Wins", items: summary.sections.wins },
    { title: "Watch out", items: summary.sections.watch },
    { title: summary.final ? "Next week" : "Rest of the week", items: summary.sections.next },
  ].filter((c) => c.items.length);
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
        {LABEL} · {summary.final ? "final" : "so far"} · AI-written · {clockTimeIn(summary.generated_at, timezone)}
      </span>
      <p className="max-w-[860px] font-serif text-[clamp(19px,2.6vw,24px)] leading-[1.35] text-pretty">{summary.headline}</p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 pt-1 md:grid-cols-3">
        {columns.map((c) => (
          <section key={c.title} className="flex flex-col gap-1.5 border-t border-divider pt-2.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">{c.title}</h3>
            {c.items.map((item) => (
              <p key={item} className="text-[13.5px] leading-[1.5] text-muted-1 text-pretty">
                {item}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** No review for this week: on the current week's Monday, a pointer to last week's final one. */
function Missing({ week, range }: { week: ProgressWeek; range: UrlRange | null }) {
  if (!week.current || week.through !== week.monday) return null;
  return (
    <p className="text-[13px] text-muted-2">
      This week&apos;s review starts tomorrow.{" "}
      <Link href={`/?${weekToSearchParams(addDays(week.monday, -7), range)}`} className="text-accent hover:underline">
        Read last week&apos;s →
      </Link>
    </p>
  );
}
