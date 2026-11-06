import type { DashboardData } from "@/lib/dashboard/types";
import { isRun } from "@/lib/data/activities";
import type { LocalDate } from "@/lib/dates/calendar";
import { isInRange } from "@/lib/heatmap/cell-state";
import { METERS_PER_MILE } from "@/lib/running/runs";

export type EffortId = "mile" | "two_mile" | "five_k" | "longest_run" | "longest_running";

/** One run's value for one effort. */
export interface EffortMark {
  value: number;
  date: LocalDate;
  activityId: string;
  name: string;
}

export interface BestEffort {
  id: EffortId;
  label: string;
  /** Times: lower is better. Distances and durations: higher is better. */
  better: "lower" | "higher";
  unit: "time" | "miles" | "duration";
  best: EffortMark;
  /** The best within the selected range, and the record standing before the range began. */
  inRange: EffortMark | null;
  before: EffortMark | null;
  /** Every time the record fell, oldest first: a step line of the best so far. */
  records: EffortMark[];
}

type Data = Pick<DashboardData, "activities" | "runEfforts" | "dateRange" | "today">;

/**
 * The best efforts card: fastest mile (Garmin's own figure where it has one), 2 miles and 5K,
 * the longest run, and the longest stretch of continuous running. Each with its all-time best,
 * the range's best against the record before it, and the record's history. Pure.
 */
export function buildBestEfforts(data: Data): BestEffort[] {
  const runs = data.activities.filter((a) => isRun(a) && a.local_date <= data.today);
  const runById = new Map(runs.map((r) => [r.id, r]));
  const efforts = data.runEfforts.filter((e) => e.local_date <= data.today);
  const mark = (value: number | null | undefined, e: { activity_id?: string; id?: string; local_date: string; name: string | null }): EffortMark[] =>
    value === null || value === undefined || value <= 0 ? [] : [{ value, date: e.local_date, activityId: (e.activity_id ?? e.id)!, name: e.name ?? "Run" }];

  const series: Omit<BestEffort, "best" | "inRange" | "before" | "records">[] = [
    { id: "mile", label: "Fastest mile", better: "lower", unit: "time" },
    { id: "two_mile", label: "Fastest 2 miles", better: "lower", unit: "time" },
    { id: "five_k", label: "Fastest 5K", better: "lower", unit: "time" },
    { id: "longest_run", label: "Longest run", better: "higher", unit: "miles" },
    { id: "longest_running", label: "Longest run without walking", better: "higher", unit: "duration" },
  ];
  const marksFor = (id: EffortId): EffortMark[] => {
    switch (id) {
      case "mile":
        // Garmin's fastest mile is measured from the full-resolution data; ours fills in when it has none.
        return efforts.flatMap((e) => mark(runById.get(e.activity_id)?.fastest_mile_s ?? e.efforts.fastest.mile, e));
      case "two_mile":
        return efforts.flatMap((e) => mark(e.efforts.fastest.two_mile, e));
      case "five_k":
        return efforts.flatMap((e) => mark(e.efforts.fastest.five_k, e));
      case "longest_run":
        return runs.flatMap((r) => mark(r.distance_m === null ? null : r.distance_m / METERS_PER_MILE, r));
      case "longest_running":
        return efforts.flatMap((e) => mark(e.efforts.longest_running?.seconds, e));
    }
  };

  return series.flatMap((s) => {
    const marks = marksFor(s.id).sort((a, b) => a.date.localeCompare(b.date));
    if (!marks.length) return [];
    const beats = (a: EffortMark, b: EffortMark | null) => !b || (s.better === "lower" ? a.value < b.value : a.value > b.value);
    const bestOf = (ms: EffortMark[]) => ms.reduce<EffortMark | null>((acc, m) => (beats(m, acc) ? m : acc), null);
    const records: EffortMark[] = [];
    for (const m of marks) if (beats(m, records.at(-1) ?? null)) records.push(m);
    return [
      {
        ...s,
        best: records.at(-1)!,
        inRange: bestOf(marks.filter((m) => isInRange(m.date, data.dateRange))),
        before: bestOf(marks.filter((m) => m.date < data.dateRange.from)),
        records,
      },
    ];
  });
}
