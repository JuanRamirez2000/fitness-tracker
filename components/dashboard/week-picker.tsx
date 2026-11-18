import Link from "next/link";
import { addDays, mondayOf, type LocalDate } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { weekToSearchParams, type UrlRange } from "@/lib/range/url";

const ARROW = "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-[15px]";

/**
 * The Progress tab's `← Week of Nov 10 →`, in the header where the range control sits on the
 * other tabs. Plain links (`?week=`, the Monday), so each week is a server render; stops at the
 * current week and at the program's first.
 */
export function WeekPicker({ week, today, programStart, range }: { week: LocalDate; today: LocalDate; programStart: LocalDate; range: UrlRange | null }) {
  const current = mondayOf(today);
  const prev = week > mondayOf(programStart) ? addDays(week, -7) : null;
  const next = week < current ? addDays(week, 7) : null;
  const href = (w: LocalDate) => `/?${weekToSearchParams(w, range)}`;
  const label = week === current ? "This week" : week === addDays(current, -7) ? "Last week" : `Week of ${fmtDate(week)}`;
  return (
    <nav aria-label="Week" className="flex items-center gap-2">
      {prev ? (
        <Link href={href(prev)} className={`${ARROW} text-muted-1 hover:border-border-strong hover:text-ink`} aria-label={`Week of ${fmtDate(prev)}`}>
          ←
        </Link>
      ) : (
        <span className={`${ARROW} text-muted-3`} aria-hidden="true">
          ←
        </span>
      )}
      <span className="flex min-w-[150px] flex-col items-center leading-tight">
        <span className="text-[13.5px] text-ink">{label}</span>
        <span className="font-mono text-[10px] text-muted-2">
          {fmtDate(week)} – {fmtDate(addDays(week, 6))}
        </span>
      </span>
      {next ? (
        <Link href={href(next)} className={`${ARROW} text-muted-1 hover:border-border-strong hover:text-ink`} aria-label={`Week of ${fmtDate(next)}`}>
          →
        </Link>
      ) : (
        <span className={`${ARROW} text-muted-3`} aria-hidden="true">
          →
        </span>
      )}
      {week !== current && (
        <Link href={href(current)} className="ml-1 text-[12px] text-muted-2 hover:text-ink">
          This week
        </Link>
      )}
    </nav>
  );
}
