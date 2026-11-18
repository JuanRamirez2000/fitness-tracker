import type { ReactNode } from "react";
import type { LocalDate } from "@/lib/dates/calendar";
import { fmtPointTitle } from "@/lib/dates/format";

const INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export interface DayCell {
  text: ReactNode;
  /** Tailwind text color for the value. */
  className?: string;
  /** The hover title (the full word behind a short one). */
  title?: string;
}

export interface DayRow {
  label: string;
  cells: DayCell[];
}

/** A Monday-to-Sunday table: one row per measure, one column per day, today's column marked.
 * Fits a phone: the day columns share what the label column leaves. */
export function DayGrid({ days, today, rows, caption }: { days: LocalDate[]; today: LocalDate; rows: DayRow[]; caption: string }) {
  return (
    <table className="w-full table-fixed border-collapse text-center">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col className="w-[76px]" />
        {days.map((d) => (
          <col key={d} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className="sr-only">
            Measure
          </th>
          {days.map((d, i) => (
            <th key={d} scope="col" className="pb-1.5 font-normal" aria-label={fmtPointTitle(d)}>
              <span className={`flex flex-col items-center font-mono text-[10px] leading-tight ${d === today ? "text-accent" : "text-muted-2"}`}>
                <span>{INITIALS[i]}</span>
                <span className="text-[9px]">{Number(d.slice(8))}</span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-divider/60">
            <th scope="row" className="py-1.5 pr-2 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.08em] text-muted-2">
              {row.label}
            </th>
            {row.cells.map((c, i) => (
              <td key={days[i]} title={c.title} className={`py-1.5 font-mono text-[13px] ${days[i] === today ? "bg-accent/6" : ""} ${c.className ?? "text-ink"}`}>
                {c.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A day with no value: after today, or nothing recorded. */
export const EMPTY_FUTURE: DayCell = { text: "·", className: "text-muted-3" };
export const EMPTY: DayCell = { text: "–", className: "text-muted-3" };
