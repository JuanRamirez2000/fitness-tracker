import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtPointTitle } from "@/lib/dates/format";
import type { SleepNight } from "@/lib/data/recovery";

const NIGHTS = 7;
const SPARKLINE_DAYS = 14;
/** More than this many hours short over a week is worth flagging. */
const DEBT_WARN_HOURS = 3;

const hasNeed = (n: SleepNight) => (n.duration_s ?? 0) > 0 && n.need_s !== null;
/** Hours short of need over the 7 nights ending `end` (negative: more than enough). */
function debtTo(nights: SleepNight[], end: string): { hours: number; nights: number } {
  const week = nights.filter((n) => n.local_date <= end && n.local_date > addDays(end, -NIGHTS) && hasNeed(n));
  return { hours: week.reduce((s, n) => s + (n.need_s! - n.duration_s!) / 3600, 0), nights: week.length };
}

/** How far short of Garmin's sleep need the last 7 nights came, in all. */
export const sleepDebt: KpiDefinition = {
  id: "sleep-debt",
  label: "Sleep debt",
  visual: "sparkline",
  emptyMessage: "No sleep need from Garmin yet",
  compute(data: DashboardData): KpiValue | null {
    const nights = data.sleep.filter((n) => n.local_date <= data.today);
    const latest = nights.filter(hasNeed).at(-1);
    if (!latest) return null;
    const now = debtTo(nights, latest.local_date);
    const avgSlept = nights.filter((n) => n.local_date > addDays(latest.local_date, -NIGHTS) && hasNeed(n));
    const meanHours = avgSlept.reduce((s, n) => s + n.duration_s! / 3600, 0) / avgSlept.length;
    const meanNeed = avgSlept.reduce((s, n) => s + n.need_s! / 3600, 0) / avgSlept.length;
    const points = Array.from({ length: SPARKLINE_DAYS }, (_, i) => addDays(latest.local_date, -(SPARKLINE_DAYS - 1 - i)))
      .map((day) => ({ day, d: debtTo(nights, day) }))
      .filter(({ d }) => d.nights > 0)
      .map(({ day, d }) => ({
        date: day,
        value: d.hours,
        text: `${Math.abs(d.hours).toFixed(1)} h ${d.hours >= 0 ? "short" : "over"}`,
        title: `7 nights to ${fmtPointTitle(day)}`,
      }));
    return {
      value: Math.max(0, now.hours),
      unit: "h",
      deltaText: now.hours <= 0 ? "caught up" : now.hours > DEBT_WARN_HOURS ? "behind" : undefined,
      tone: now.hours <= 0 ? "good" : now.hours > DEBT_WARN_HOURS ? "warn" : "neutral",
      sub: `Last 7 nights · ${meanHours.toFixed(1)} of ${meanNeed.toFixed(1)} h a night`,
      points,
    };
  },
  format(v) {
    return { primary: v.value!.toFixed(1), delta: v.deltaText, tone: v.tone };
  },
};
