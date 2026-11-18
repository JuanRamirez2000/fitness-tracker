import type { DashboardData, KpiPoint } from "@/lib/dashboard/types";
import type { Activity } from "@/lib/data/activities";
import type { PlannedWorkout } from "@/lib/data/planned";
import type { DailyTraining } from "@/lib/data/training";
import { addDays, diffDays, eachDay, mondayOf, type LocalDate } from "@/lib/dates/calendar";
import { fmtRaceTime } from "@/lib/charts/fitness";
import { runRamp, type RunRamp } from "@/lib/running/ramp";
import { easyPaceAtRefHr, EFFICIENCY_REF_HR, fmtPace, median, runsOf } from "@/lib/running/runs";
import type { ActiveSport } from "@/lib/sport";
import { COACH_PROVIDER, plannedMinutes, sessionSport } from "@/lib/workouts/plan";
import { planVsDone } from "./build";

/**
 * "Is my plan working?": one card per training plan on the Garmin calendar (Runna, Garmin
 * Coach, any app that pushes a plan), each judged by what that plan is for. A run plan named
 * for a race distance follows Garmin's prediction for it; a ride plan follows FTP; every plan
 * shows how much of it was done. Plans come and go with the calendar: nothing here names one.
 * Pure, unit-tested (plans.test.ts).
 */

/** "10k Plan (Week 3/12)", Runna's description header; other apps may write the same. */
const WEEK_TAG = /\(\s*week\s+(\d+)\s*\/\s*(\d+)\s*\)/i;
/** Easy runs this far either side of the start make the efficiency baseline and "now". */
const EASY_WINDOW_DAYS = 42;
const EASY_RUNS = 5;
/** History shown before the plan began, so the start has something to stand against. */
const LEAD_IN_DAYS = 28;

export type PlanMetricId = "race_5k_s" | "race_10k_s" | "race_half_s" | "race_marathon_s" | "vo2max" | "vo2max_cycling" | "ftp_w" | "easy_pace";

export interface PlanMetric {
  id: PlanMetricId;
  label: string;
  better: "lower" | "higher";
  now: { value: number; date: LocalDate };
  /** The value the plan started from: the last one on or before its first day, else the first after. */
  start: { value: number; date: LocalDate } | null;
  /** now − start, when they're different days. */
  change: number | null;
  tone: "good" | "warn" | "neutral";
  /** Display strings: "1:03:47", "▼ 0:12 since Nov 16". */
  text: string;
  changeText: string;
  /** From a few weeks before the start through the day asked about. */
  points: KpiPoint[];
}

export interface PlanProgress {
  key: string;
  sport: ActiveSport;
  /** "Runna", "Garmin Coach". */
  who: string;
  name: string | null;
  start: LocalDate;
  /** The last day, when the plan says how many weeks it has. */
  end: LocalDate | null;
  week: number | null;
  weeks: number | null;
  /** 0..1 through the plan, when its length is known. */
  elapsed: number | null;
  /** The plan's goal measure first. */
  metrics: PlanMetric[];
  adherence: {
    due: number;
    done: number;
    keyDue: number;
    keyDone: number;
    /** The latest missed sessions, "Thu Tempo". */
    missed: string[];
  };
  next: { date: LocalDate; name: string; minutes: string; key: boolean } | null;
  /** Running plans: how fast the mileage is climbing. */
  ramp: RunRamp | null;
}

type Data = Pick<DashboardData, "activities" | "training" | "planHistory" | "today">;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayName = (date: LocalDate) => WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
const shortDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The race a plan's name points at ("10k Plan" -> 10K), or null. */
export function raceOf(name: string | null): Extract<PlanMetricId, `race_${string}`> | null {
  if (!name) return null;
  if (/half/i.test(name)) return "race_half_s";
  if (/marathon/i.test(name)) return "race_marathon_s";
  if (/10\s*k/i.test(name)) return "race_10k_s";
  if (/5\s*k/i.test(name)) return "race_5k_s";
  return null;
}

const RACE_LABEL: Record<string, string> = { race_5k_s: "5K", race_10k_s: "10K", race_half_s: "half marathon", race_marathon_s: "marathon" };

interface Group {
  key: string;
  sport: ActiveSport;
  who: string;
  name: string | null;
  sessions: PlannedWorkout[];
}

/** Calendar plan rows grouped into plans: who planned them, the plan's name, the sport. Workouts
 * made by hand in Garmin Connect (no provider, no plan name) and the tracker's own aren't a plan. */
function groupPlans(rows: readonly PlannedWorkout[]): Group[] {
  const groups = new Map<string, Group>();
  for (const s of rows) {
    if (s.source !== "garmin" || s.rest_day) continue;
    const sport = sessionSport(s);
    const who = s.provider ?? (s.plan_name ? COACH_PROVIDER : null);
    if (!sport || !who) continue;
    const key = `${who}|${s.plan_name ?? ""}|${sport}`;
    const g = groups.get(key) ?? { key, sport, who, name: s.plan_name, sessions: [] };
    g.sessions.push(s);
    groups.set(key, g);
  }
  for (const g of groups.values()) g.sessions.sort((a, b) => a.local_date.localeCompare(b.local_date));
  return [...groups.values()];
}

/** Where the plan starts and ends: its week tags when it has them ("Week 3/12" on a Wednesday
 * puts week 1 on the Monday two weeks before), else its first and last known sessions. */
function span(g: Group): { start: LocalDate; end: LocalDate | null; weeks: number | null } {
  let start: LocalDate | null = null;
  let weeks: number | null = null;
  for (const s of g.sessions) {
    const m = s.description?.match(WEEK_TAG);
    if (!m) continue;
    const begin = addDays(mondayOf(s.local_date), -7 * (Number(m[1]) - 1));
    if (!start || begin < start) start = begin;
    weeks = Math.max(weeks ?? 0, Number(m[2]));
  }
  if (start && weeks) return { start, end: addDays(start, weeks * 7 - 1), weeks };
  return { start: g.sessions[0].local_date, end: null, weeks: null };
}

function seriesMetric(
  training: readonly DailyTraining[],
  id: Exclude<PlanMetricId, "easy_pace">,
  label: string,
  better: PlanMetric["better"],
  fmt: (n: number) => string,
  start: LocalDate,
  asOf: LocalDate,
): PlanMetric | null {
  const days = training.flatMap((t) => {
    const v = t[id];
    return v === null || t.local_date > asOf ? [] : [{ date: t.local_date, value: Number(v) }];
  });
  if (!days.length) return null;
  const before = days.filter((d) => d.date <= start).at(-1) ?? days.find((d) => d.date > start) ?? null;
  const points = days.filter((d) => d.date >= addDays(start, -LEAD_IN_DAYS)).map((d) => ({ date: d.date, value: d.value, text: fmt(d.value) }));
  return finish({ id, label, better, now: days.at(-1)!, start: before, fmt, points });
}

/** Easy-run pace scaled to 130 bpm: the median of the latest few easy runs against the few
 * before the plan began. Faster at the same heart rate is a fitter aerobic engine. */
function easyPaceMetric(activities: readonly Activity[], start: LocalDate, asOf: LocalDate): PlanMetric | null {
  const scored = runsOf([...activities]).flatMap((r) => {
    const pace = r.local_date <= asOf ? easyPaceAtRefHr(r) : null;
    return pace === null ? [] : [{ date: r.local_date, value: pace }];
  });
  const recent = scored.filter((p) => p.date >= addDays(asOf, -EASY_WINDOW_DAYS)).slice(-EASY_RUNS);
  if (!recent.length) return null;
  const base = scored.filter((p) => p.date < start && p.date >= addDays(start, -EASY_WINDOW_DAYS)).slice(-EASY_RUNS);
  const now = { value: median(recent.map((p) => p.value))!, date: recent.at(-1)!.date };
  // No easy run before the start: the plan's first ones are the baseline.
  const baseRuns = base.length ? base : scored.filter((p) => p.date >= start).slice(0, EASY_RUNS);
  const startMark = baseRuns.length && baseRuns.at(-1)!.date < now.date ? { value: median(baseRuns.map((p) => p.value))!, date: baseRuns.at(-1)!.date } : null;
  const points = scored.filter((p) => p.date >= addDays(start, -LEAD_IN_DAYS)).map((p) => ({ ...p, text: `${fmtPace(p.value)} /mi` }));
  return finish({ id: "easy_pace", label: `Easy pace at ${EFFICIENCY_REF_HR} bpm`, better: "lower", now, start: startMark, fmt: (n) => `${fmtPace(n)} /mi`, points });
}

function finish(m: {
  id: PlanMetricId;
  label: string;
  better: PlanMetric["better"];
  now: { value: number; date: LocalDate };
  start: { value: number; date: LocalDate } | null;
  fmt: (n: number) => string;
  points: KpiPoint[];
}): PlanMetric {
  const change = m.start && m.start.date < m.now.date ? m.now.value - m.start.value : null;
  const better = change === null || change === 0 ? null : (m.better === "lower") === change < 0;
  const size = change === null ? "" : m.id.startsWith("race_") ? fmtRaceTime(change) : m.id === "easy_pace" ? fmtPace(Math.abs(change)) : String(Math.round(Math.abs(change) * 10) / 10);
  const word = change === null ? "" : change === 0 ? "no change" : m.id.startsWith("race_") || m.id === "easy_pace" ? (change < 0 ? `▼ ${size} faster` : `▲ ${size} slower`) : `${change > 0 ? "▲" : "▼"} ${size}`;
  return {
    id: m.id,
    label: m.label,
    better: m.better,
    now: m.now,
    start: m.start,
    change,
    tone: better === null ? "neutral" : better ? "good" : "warn",
    text: m.fmt(m.now.value),
    changeText: change === null ? (m.start ? "where the plan starts" : "no reading from before the plan") : `${word} since ${shortDate(m.start!.date)}`,
    points: m.points,
  };
}

function metricsFor(g: Group, data: Data, start: LocalDate, asOf: LocalDate): PlanMetric[] {
  const t = data.training;
  const out: (PlanMetric | null)[] = [];
  if (g.sport === "run") {
    const race = raceOf(g.name);
    if (race) out.push(seriesMetric(t, race, `Predicted ${RACE_LABEL[race]}`, "lower", fmtRaceTime, start, asOf));
    out.push(seriesMetric(t, "vo2max", "Running VO2 max", "higher", (n) => n.toFixed(1), start, asOf));
    out.push(easyPaceMetric(data.activities, start, asOf));
  } else if (g.sport === "ride") {
    out.push(seriesMetric(t, "ftp_w", "FTP", "higher", (n) => `${Math.round(n)} W`, start, asOf));
    out.push(seriesMetric(t, "vo2max_cycling", "Cycling VO2 max", "higher", (n) => n.toFixed(1), start, asOf));
  }
  // Swims: Garmin has no swim fitness number; the card shows the plan and how much was done.
  return out.filter((m): m is PlanMetric => m !== null);
}

/**
 * Every plan running in the week ending `asOf` (the Progress tab's week, so a past week shows
 * the plans of that week): started by then, with a session in that week or after it (in the
 * current week, from today on).
 */
export function planProgress(data: Data, asOf: LocalDate): PlanProgress[] {
  const weekStart = mondayOf(asOf);
  return groupPlans(data.planHistory).flatMap((g): PlanProgress[] => {
    const { start, end, weeks } = span(g);
    // In the current week a plan needs something still to come: a plan switched away from
    // keeps its old rows, but nothing after today.
    const live = asOf >= data.today ? g.sessions.some((s) => s.local_date >= data.today) : g.sessions.some((s) => s.local_date >= weekStart);
    if (start > asOf || !live) return [];
    const to = end && end < asOf ? end : asOf;
    const done = planVsDone(
      { activities: data.activities, planned: g.sessions, today: data.today },
      { monday: start, sunday: to, days: eachDay(start, to), current: to >= data.today, through: to },
    );
    const items = done.days.flatMap((d) => d.planned);
    const due = items.filter((i) => i.status !== "upcoming" && i.status !== "today");
    const after = g.sessions.find((s) => s.local_date > asOf || (s.local_date === asOf && items.some((i) => i.session === s && i.status === "today")));
    const week = Math.min(weeks ?? Infinity, Math.floor(diffDays(asOf, start) / 7) + 1);
    return [
      {
        key: g.key,
        sport: g.sport,
        who: g.who,
        name: g.name,
        start,
        end,
        week: weeks ? week : null,
        weeks,
        elapsed: end ? Math.min(1, (diffDays(asOf, start) + 1) / (diffDays(end, start) + 1)) : null,
        metrics: metricsFor(g, data, start, asOf),
        adherence: {
          due: due.length,
          done: due.filter((i) => i.status === "done" || i.status === "moved").length,
          keyDue: due.filter((i) => i.session.key_workout).length,
          keyDone: due.filter((i) => i.session.key_workout && (i.status === "done" || i.status === "moved")).length,
          missed: due.filter((i) => i.status === "missed").slice(-3).map((i) => `${dayName(i.session.local_date)} ${i.session.name ?? "session"}`),
        },
        next: after ? { date: after.local_date, name: after.name ?? "Workout", minutes: plannedMinutes(after), key: after.key_workout } : null,
        ramp: g.sport === "run" ? runRamp(data.activities, asOf) : null,
      },
    ];
  });
}
