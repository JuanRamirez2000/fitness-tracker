import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays, diffDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";

export const daysSinceShot: KpiDefinition = {
  id: "days-since-shot",
  label: "Days since shot",
  emptyMessage: "No shot logged yet",
  compute(data: DashboardData): KpiValue | null {
    // data.injections is unbounded and not necessarily sorted by the caller; find the
    // latest one at or before today ourselves rather than assuming order.
    let last: string | null = null;
    for (const injection of data.injections) {
      if (injection.local_date <= data.today && (last === null || injection.local_date > last)) {
        last = injection.local_date;
      }
    }
    if (last === null) return null;

    const days = diffDays(data.today, last);
    return {
      value: days,
      unit: days === 1 ? "day" : "days",
      tone: "neutral",
      // A simple +7-day guess (the schedule's own weekday is the authoritative source; this
      // just previews the next one without recomputing the full schedule here).
      sub: `Next ${fmtDate(addDays(last, 7))}`,
    };
  },
  format(v) {
    return { primary: String(v.value), tone: v.tone };
  },
};
