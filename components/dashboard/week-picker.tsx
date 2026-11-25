import Link from "next/link";
import { addDays, mondayOf, type LocalDate } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { weekToSearchParams, type UrlRange } from "@/lib/range/url";
import type { TabKey } from "@/lib/dashboard/types";

const ARROW = "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-[15px]";
const COMPACT_ARROW = "flex h-8 w-8 items-center justify-center rounded-lg text-[19px] leading-none";

/**
 * The header's `← Week of Nov 10 →`: one week for every tab (each tab's week so far and
 * swipeable section). Plain links (`?week=`, the Monday; none for the current week), so each
 * week is a server render that keeps the page where it is; stops at the current week and at the
 * program's first.
 */
export function WeekPicker({
  week,
  today,
  programStart,
  range,
  tab,
  compact = false,
}: {
  week: LocalDate;
  today: LocalDate;
  programStart: LocalDate;
  range: UrlRange | null;
  tab: TabKey;
  /** The phone header's one-line `← This week →`: smaller arrows, and the label itself links back to this week. */
  compact?: boolean;
}) {
  const current = mondayOf(today);
  const prev = week > mondayOf(programStart) ? addDays(week, -7) : null;
  const next = week < current ? addDays(week, 7) : null;
  const href = (w: LocalDate) => `/?${weekToSearchParams(w === current ? null : w, range, tab)}`;
  const label = week === current ? "This week" : week === addDays(current, -7) ? "Last week" : `Week of ${fmtDate(week)}`;
  if (compact) {
    const span = `${fmtDate(week)} – ${fmtDate(addDays(week, 6))}`;
    const arrow = (to: LocalDate | null, glyph: string) =>
      to ? (
        <Link scroll={false} href={href(to)} className={`${COMPACT_ARROW} text-muted-1`} aria-label={`Week of ${fmtDate(to)}`}>
          {glyph}
        </Link>
      ) : (
        <span className={`${COMPACT_ARROW} text-muted-3`} aria-hidden="true">
          {glyph}
        </span>
      );
    return (
      <nav aria-label="Week" className="flex items-center gap-1">
        {arrow(prev, "‹")}
        {week === current ? (
          <span className="min-w-[96px] text-center text-[13px] leading-tight text-ink" title={span}>
            {label}
          </span>
        ) : (
          <Link scroll={false} href={href(current)} className="min-w-[96px] text-center text-[13px] leading-tight text-ink" title={`${span} · tap for this week`}>
            {week === addDays(current, -7) ? label : span}
          </Link>
        )}
        {arrow(next, "›")}
      </nav>
    );
  }
  return (
    <nav aria-label="Week" className="flex items-center gap-2">
      {prev ? (
        <Link scroll={false} href={href(prev)} className={`${ARROW} text-muted-1 hover:border-border-strong hover:text-ink`} aria-label={`Week of ${fmtDate(prev)}`}>
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
        <Link scroll={false} href={href(next)} className={`${ARROW} text-muted-1 hover:border-border-strong hover:text-ink`} aria-label={`Week of ${fmtDate(next)}`}>
          →
        </Link>
      ) : (
        <span className={`${ARROW} text-muted-3`} aria-hidden="true">
          →
        </span>
      )}
      {week !== current && (
        <Link scroll={false} href={href(current)} className="ml-1 text-[12px] text-muted-2 hover:text-ink">
          This week
        </Link>
      )}
    </nav>
  );
}
