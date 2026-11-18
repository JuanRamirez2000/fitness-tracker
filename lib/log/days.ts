import type { DashboardData } from "@/lib/dashboard/types";
import { eachDay, type LocalDate } from "@/lib/dates/calendar";
import { sportOf, type ActiveSport } from "@/lib/sport";
import { sessionSport } from "@/lib/workouts/plan";

/**
 * The Log tab's day-by-day view of everything the app has recorded: one row per day with the
 * day's weight, readiness, sleep, HRV, resting HR, steps, Body Battery, mood, activities and
 * planned sessions. Repeats the other tabs on purpose: it's the place to see what data exists
 * and where the gaps are. Pure, unit-tested (days.test.ts).
 */

export interface DayActivity {
  id: string;
  sport: ActiveSport | null;
  name: string;
  minutes: number;
}

export interface DayRow {
  date: LocalDate;
  weightLb: number | null;
  readiness: number | null;
  sleepScore: number | null;
  sleepHours: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  steps: number | null;
  batteryWake: number | null;
  mood: number | null;
  activities: DayActivity[];
  load: number | null;
  /** Planned sessions that day (rest days aside), and how many had that sport done that day. */
  planned: number;
  plannedDone: number;
}

export type LogKind = "activities" | "weight" | "mood" | "sleep" | "readiness" | "steps";
export const LOG_KINDS: { key: LogKind; label: string }[] = [
  { key: "activities", label: "Activities" },
  { key: "weight", label: "Weigh-ins" },
  { key: "sleep", label: "Sleep" },
  { key: "readiness", label: "Readiness" },
  { key: "steps", label: "Steps" },
  { key: "mood", label: "Mood" },
];

/** Whether a day has one kind of data, for the coverage views and the month grid's markers. */
export function has(row: DayRow, kind: LogKind): boolean {
  switch (kind) {
    case "activities":
      return row.activities.length > 0;
    case "weight":
      return row.weightLb !== null;
    case "mood":
      return row.mood !== null;
    case "sleep":
      return row.sleepHours !== null;
    case "readiness":
      return row.readiness !== null;
    case "steps":
      return row.steps !== null;
  }
}

type Data = Pick<DashboardData, "activities" | "weightTrend" | "recovery" | "sleep" | "moodLogs" | "heatmap" | "planHistory" | "today">;

/** Every day from `from` to `to` (never past today), oldest first. */
export function buildDays(data: Data, from: LocalDate, to: LocalDate): DayRow[] {
  const end = to > data.today ? data.today : to;
  if (end < from) return [];
  const byDate = <T extends { local_date: LocalDate }>(rows: readonly T[]) => {
    const m = new Map<LocalDate, T[]>();
    for (const r of rows) {
      if (r.local_date < from || r.local_date > end) continue;
      m.set(r.local_date, [...(m.get(r.local_date) ?? []), r]);
    }
    return m;
  };
  const weights = byDate(data.weightTrend);
  const recovery = byDate(data.recovery);
  const sleep = byDate(data.sleep);
  const moods = byDate(data.moodLogs);
  const steps = byDate(data.heatmap.steps);
  const acts = byDate(data.activities);
  const plans = byDate(data.planHistory.filter((s) => !s.rest_day));

  return eachDay(from, end).map((date): DayRow => {
    const r = recovery.get(date)?.[0];
    const night = sleep.get(date)?.find((n) => (n.duration_s ?? 0) > 0);
    const dayActs = acts.get(date) ?? [];
    const sports = new Set(dayActs.map((a) => sportOf(a.activity_type)));
    const planned = plans.get(date) ?? [];
    const load = dayActs.reduce((s, a) => s + (a.training_load ?? 0), 0);
    return {
      date,
      weightLb: weights.get(date)?.[0]?.weight_lb ?? null,
      readiness: r ? (r.readiness_morning_score ?? r.readiness_score) : null,
      sleepScore: night?.score ?? null,
      sleepHours: night ? night.duration_s! / 3600 : null,
      hrvMs: r?.hrv_ms ?? null,
      restingHr: r?.resting_hr ?? null,
      steps: steps.get(date)?.[0]?.steps ?? null,
      batteryWake: r?.body_battery_wake ?? null,
      mood: moods.get(date)?.[0]?.mood ?? null,
      activities: dayActs.map((a) => {
        const sport = sportOf(a.activity_type);
        return { id: a.id, sport: sport === "other" ? null : sport, name: a.name ?? a.activity_type, minutes: Math.round((a.moving_duration_s ?? a.duration_s) / 60) };
      }),
      load: dayActs.length ? Math.round(load) : null,
      planned: planned.length,
      plannedDone: planned.filter((s) => sports.has(sessionSport(s) ?? "other")).length,
    };
  });
}
