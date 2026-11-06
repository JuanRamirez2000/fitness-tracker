import type { DashboardData, KpiDefinition, KpiValue } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { signed } from "./format";

const SPARKLINE_NIGHTS = 14;

/** Last night's sleep score, against the week before it. */
export const sleepScore: KpiDefinition = {
  id: "sleep-score",
  label: "Sleep score",
  visual: "sparkline",
  emptyMessage: "No sleep scores yet",
  compute(data: DashboardData): KpiValue | null {
    const scored = data.sleep.filter((n) => n.local_date <= data.today && n.score !== null);
    const last = scored.at(-1);
    if (!last) return null;
    const week = scored.filter((n) => n.local_date < last.local_date && n.local_date >= addDays(last.local_date, -7));
    const avg = week.length ? week.reduce((s, n) => s + n.score!, 0) / week.length : null;
    const hours = (last.duration_s ?? 0) / 3600;
    const day = last.local_date === data.today ? "Last night" : `Night to ${fmtDate(last.local_date)}`;
    return {
      value: last.score,
      unit: "",
      delta: avg === null ? undefined : last.score! - avg,
      tone: avg === null ? "neutral" : last.score! >= avg ? "good" : "warn",
      sub: `${day} · ${hours.toFixed(1)} h${avg !== null ? ` · vs the week's ${Math.round(avg)}` : ""}`,
      points: scored.slice(-SPARKLINE_NIGHTS).map((n) => ({ date: n.local_date, value: n.score!, text: `${n.score} · ${((n.duration_s ?? 0) / 3600).toFixed(1)} h` })),
    };
  },
  format(v) {
    return { primary: String(v.value), delta: v.delta === undefined ? undefined : signed(v.delta, 0), tone: v.tone };
  },
};
