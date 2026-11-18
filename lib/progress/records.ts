import type { DashboardData } from "@/lib/dashboard/types";
import type { Activity } from "@/lib/data/activities";
import { addDays, mondayOf, type LocalDate } from "@/lib/dates/calendar";
import { buildBestEfforts, type BestEffort } from "@/lib/charts/best-efforts";
import { fmtDurationShort, RECORD_DURATIONS } from "@/lib/charts/power-curve";
import { fmtDuration, METERS_PER_MILE } from "@/lib/running/runs";
import { isRide, isRun, isSwim, sportOf, type ActiveSport } from "@/lib/sport";

/**
 * Every record and milestone, newest first: run best efforts falling, power bests, the
 * longest ride and swim, the biggest week, VO2 max highs, and running miles and training
 * hours adding up since the program began. Only from the program's start (old swims from
 * years ago set the bar but don't show as records). Pure, unit-tested (records.test.ts).
 */

export interface RecordEvent {
  key: string;
  date: LocalDate;
  /** null for a cross-sport record (the biggest week, total hours). */
  sport: ActiveSport | null;
  kind: "record" | "milestone";
  title: string;
  /** "6:58", "245 W", "12.4 mi". */
  value: string;
  /** What it beat: "was 7:05". */
  previous: string | null;
  activityId: string | null;
}

type Data = Pick<DashboardData, "activities" | "runEfforts" | "training" | "today" | "programStart" | "dateRange">;

const RUN_MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];
const HOUR_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];
const YARDS_PER_METER = 1.09361;

const hoursOf = (a: Activity) => (a.moving_duration_s ?? a.duration_s) / 3600;

/** Each time a running best fell (the first ever mark isn't a record: there was nothing to beat). */
function effortRecords(efforts: BestEffort[]): RecordEvent[] {
  const fmt = (e: BestEffort, v: number) => (e.unit === "time" || e.unit === "duration" ? fmtDuration(v) : `${v.toFixed(1)} mi`);
  return efforts.flatMap((e) =>
    e.records.slice(1).map((m, i) => ({
      key: `effort:${e.id}:${m.date}`,
      date: m.date,
      sport: "run" as const,
      kind: "record" as const,
      title: e.label,
      value: fmt(e, m.value),
      previous: `was ${fmt(e, e.records[i].value)}`,
      activityId: m.activityId,
    })),
  );
}

/** Running bests over activities, oldest first: an event each time `value` beats the best so far. */
function bests(
  activities: readonly Activity[],
  key: string,
  title: string,
  sport: ActiveSport,
  value: (a: Activity) => number | null,
  fmt: (n: number) => string,
): RecordEvent[] {
  const out: RecordEvent[] = [];
  let best: number | null = null;
  for (const a of activities) {
    const v = value(a);
    if (v === null || v <= 0) continue;
    if (best !== null && v > best) {
      out.push({ key: `${key}:${a.id}`, date: a.local_date, sport, kind: "record", title, value: fmt(v), previous: `was ${fmt(best)}`, activityId: a.id });
    }
    if (best === null || v > best) best = v;
  }
  return out;
}

export function buildRecords(data: Data): RecordEvent[] {
  const done = data.activities.filter((a) => a.local_date <= data.today);
  const rides = done.filter(isRide);
  const events: RecordEvent[] = [
    ...effortRecords(buildBestEfforts({ ...data, dateRange: { key: "all", from: data.programStart, to: data.today } })),
    ...RECORD_DURATIONS.flatMap((s) =>
      bests(rides, `power:${s}`, `Best ${fmtDurationShort(s)} power`, "ride", (a) => a.power_curve?.[String(s)] ?? null, (w) => `${Math.round(w)} W`),
    ),
    ...bests(rides, "ride-time", "Longest ride", "ride", (a) => (a.moving_duration_s ?? a.duration_s) || null, fmtDuration),
    ...bests(done.filter(isSwim), "swim-distance", "Longest swim", "swim", (a) => a.distance_m, (m) => `${Math.round((m * YARDS_PER_METER) / 25) * 25} yd`),
  ];

  // VO2 max highs, running and cycling (Garmin's daily value; the first reading isn't a record).
  for (const [field, title, sport] of [["vo2max", "Running VO2 max high", "run"], ["vo2max_cycling", "Cycling VO2 max high", "ride"]] as const) {
    let best: number | null = null;
    for (const t of data.training) {
      const v = t[field] === null ? null : Number(t[field]);
      if (v === null || t.local_date > data.today) continue;
      if (best !== null && v > best) {
        events.push({ key: `${field}:${t.local_date}`, date: t.local_date, sport, kind: "record", title, value: v.toFixed(1), previous: `was ${best.toFixed(1)}`, activityId: null });
      }
      if (best === null || v > best) best = v;
    }
  }

  // The biggest finished Monday-to-Sunday week of training time.
  const weekHours = new Map<LocalDate, number>();
  for (const a of done) weekHours.set(mondayOf(a.local_date), (weekHours.get(mondayOf(a.local_date)) ?? 0) + hoursOf(a));
  let bestWeek: number | null = null;
  for (const monday of [...weekHours.keys()].sort()) {
    const sunday = addDays(monday, 6);
    if (sunday >= data.today) continue;
    const h = weekHours.get(monday)!;
    if (bestWeek !== null && h > bestWeek) {
      events.push({ key: `week:${monday}`, date: sunday, sport: null, kind: "record", title: "Biggest training week", value: `${h.toFixed(1)} h`, previous: `was ${bestWeek.toFixed(1)} h`, activityId: null });
    }
    if (bestWeek === null || h > bestWeek) bestWeek = h;
  }

  // Milestones since the program began: running miles and training hours adding up.
  const since = done.filter((a) => a.local_date >= data.programStart);
  const milestone = (key: string, title: string, sport: ActiveSport | null, marks: number[], amount: (a: Activity) => number, unit: string) => {
    let total = 0;
    let next = 0;
    for (const a of since) {
      total += amount(a);
      while (next < marks.length && total >= marks[next]) {
        events.push({ key: `${key}:${marks[next]}`, date: a.local_date, sport, kind: "milestone", title, value: `${marks[next]} ${unit}`, previous: null, activityId: a.id });
        next += 1;
      }
    }
  };
  milestone("run-miles", "Running miles since you started", "run", RUN_MILESTONES, (a) => (isRun(a) ? (a.distance_m ?? 0) / METERS_PER_MILE : 0), "mi");
  milestone("hours", "Training hours since you started", null, HOUR_MILESTONES, (a) => (sportOf(a.activity_type) === "other" ? 0 : hoursOf(a)), "h");

  return events.filter((e) => e.date >= data.programStart).sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}
