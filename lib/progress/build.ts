import type { DashboardData, KpiValue } from "@/lib/dashboard/types";
import type { Activity } from "@/lib/data/activities";
import type { MoodLog } from "@/lib/data/mood";
import type { PlannedWorkout } from "@/lib/data/planned";
import { addDays, diffDays, eachDay, mondayOf, type LocalDate } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { sportOf, SPORTS, type ActiveSport } from "@/lib/sport";
import { phaseOn, sessionSport } from "@/lib/workouts/plan";
import type { ProgressWeek } from "./week";

/**
 * The Progress tab's numbers for one Monday-to-Sunday week: the top cards, hours by sport over
 * the last 12 weeks, planned sessions against what was done, and the week's recovery and mood.
 * Pure, unit-tested (build.test.ts).
 */

/** The bottom of the weekly training band (the top is workout_settings.weekly_hours_max). */
export const WEEKLY_HOURS_MIN = 4;
/** A week's load up more than this on the week before is a jump worth flagging. */
export const LOAD_JUMP = 0.15;
export const HOURS_WEEKS = 12;
const LOAD_WEEKS = 8;

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (date: LocalDate) => SHORT_WEEKDAYS[(diffDays(date, mondayOf(date)) + 1) % 7];

const hoursOf = (a: Activity) => (a.moving_duration_s ?? a.duration_s) / 3600;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const inDays = (date: LocalDate, from: LocalDate, to: LocalDate) => date >= from && date <= to;
const loadBetween = (activities: readonly Activity[], from: LocalDate, to: LocalDate) =>
  activities.reduce((sum, a) => (inDays(a.local_date, from, to) ? sum + (a.training_load ?? 0) : sum), 0);

// ---------- Top cards ----------

/** Garmin training load for the week against the week before. In the current week the
 * comparison is the same days of last week, so a Tuesday isn't measured against a whole week. */
export function loadCard(activities: readonly Activity[], week: ProgressWeek): KpiValue {
  const days = diffDays(week.through, week.monday) + 1;
  const load = loadBetween(activities, week.monday, week.through);
  const prevFrom = addDays(week.monday, -7);
  const compare = loadBetween(activities, prevFrom, addDays(prevFrom, days - 1));
  const label = days === 7 ? "last week" : `last week through ${weekday(addDays(prevFrom, days - 1))}`;
  // Nothing yet this week isn't a "−100%": the week just hasn't started.
  const change = compare > 0 && !(week.current && load === 0) ? (load - compare) / compare : null;
  const jump = change !== null && change > LOAD_JUMP;
  const points = Array.from({ length: LOAD_WEEKS }, (_, i) => {
    const monday = addDays(week.monday, -7 * (LOAD_WEEKS - 1 - i));
    const end = monday === week.monday ? week.through : addDays(monday, 6);
    const value = Math.round(loadBetween(activities, monday, end));
    return { date: monday, value, text: String(value), title: `${fmtPointTitle(monday, true)}${end < addDays(monday, 6) ? " (so far)" : ""}` };
  });
  return {
    value: Math.round(load),
    unit: "load",
    delta: change === null ? undefined : Math.round(change * 100),
    deltaUnit: "%",
    tone: jump ? "warn" : change !== null && change >= 0 ? "good" : "neutral",
    sub:
      compare === 0
        ? `nothing logged ${label}`
        : `vs ${Math.round(compare)} ${label}${jump ? ` · more than the ~${LOAD_JUMP * 100}% a week that's safe to add` : ""}`,
    points: points.some((p) => p.value > 0) ? points : undefined,
  };
}

const readinessOf = (r: DashboardData["recovery"][number]) => r.readiness_morning_score ?? r.readiness_score;

/** The week's average readiness (against the week before) and how the mood log read. */
export function readinessCard(data: Pick<DashboardData, "recovery" | "moodLogs">, week: ProgressWeek): KpiValue | null {
  const scores = (from: LocalDate, to: LocalDate) =>
    data.recovery.flatMap((r) => {
      const s = readinessOf(r);
      return s !== null && inDays(r.local_date, from, to) ? [{ date: r.local_date, value: s }] : [];
    });
  const days = scores(week.monday, week.through);
  const avg = mean(days.map((d) => d.value));
  if (avg === null) return null;
  const prev = mean(scores(addDays(week.monday, -7), addDays(week.monday, -1)).map((d) => d.value));
  const logs = data.moodLogs.filter((l) => inDays(l.local_date, week.monday, week.through));
  const mood = mean(logs.flatMap((l) => (l.mood === null ? [] : [l.mood])));
  const sick = logs.filter((l) => l.sick).length;
  const injured = logs.filter((l) => l.injured).length;
  const span = diffDays(week.through, week.monday) + 1;
  const feel = [
    mood === null ? "no mood logged" : `mood ${mood.toFixed(1)} of 5 (${logs.length} of ${span} days logged)`,
    sick ? `sick ${sick} ${sick === 1 ? "day" : "days"}` : null,
    injured ? `injured ${injured} ${injured === 1 ? "day" : "days"}` : null,
  ].filter(Boolean);
  return {
    value: Math.round(avg),
    unit: "avg",
    delta: prev === null ? undefined : Math.round(avg - prev),
    tone: avg >= 75 ? "good" : avg >= 50 ? "neutral" : "warn",
    sub: feel.join(" · "),
    points: days.map((d) => ({ date: d.date, value: d.value, text: String(d.value) })),
  };
}

/** Weeks to the A race as of the week's last day so far, with the training phase. */
export function countdownCard(data: Pick<DashboardData, "profile">, week: ProgressWeek): KpiValue | null {
  const race = data.profile.workout_settings.race;
  if (!race) return null;
  const phase = phaseOn(week.through, race);
  const days = diffDays(race.date, week.through);
  return {
    value: days >= 0 ? (phase.weeksToRace ?? 0) : null,
    unit: days >= 0 ? (phase.weeksToRace === 1 ? "week" : "weeks") : "",
    deltaText: phase.label,
    tone: "neutral",
    sub: `${race.name} · ${fmtDate(race.date)}${days >= 0 && days % 7 ? ` (${days} days)` : ""}`,
  };
}

// ---------- Hours by sport ----------

export interface HoursWeek {
  monday: LocalDate;
  hours: Record<ActiveSport, number>;
  total: number;
  selected: boolean;
  /** The current week, still in progress. */
  partial: boolean;
}

export interface HoursBySport {
  weeks: HoursWeek[];
  /** Sports with any hours in the 12 weeks, in SPORTS order. */
  sports: ActiveSport[];
  band: { min: number; max: number };
  selected: HoursWeek;
  /** Average over the complete weeks shown. */
  avg: number | null;
  /** Complete weeks inside the band, out of `complete`. */
  inBand: number;
  complete: number;
}

const zeroHours = () => Object.fromEntries(SPORTS.map((s) => [s, 0])) as Record<ActiveSport, number>;

/** Hours per Monday week, stacked by sport, for the 12 weeks ending on the chosen one (from the
 * first week with any activity), against the 4–7 h band. */
export function hoursBySport(data: Pick<DashboardData, "activities" | "profile" | "today">, week: ProgressWeek): HoursBySport | null {
  const first = data.activities.find((a) => sportOf(a.activity_type) !== "other");
  if (!first) return null;
  const start = mondayOf(first.local_date);
  const weeks: HoursWeek[] = [];
  for (let i = HOURS_WEEKS - 1; i >= 0; i--) {
    const monday = addDays(week.monday, -7 * i);
    if (monday < start) continue;
    const sunday = addDays(monday, 6);
    const hours = zeroHours();
    for (const a of data.activities) {
      const sport = sportOf(a.activity_type);
      if (sport !== "other" && inDays(a.local_date, monday, sunday)) hours[sport] += hoursOf(a);
    }
    weeks.push({ monday, hours, total: SPORTS.reduce((s, k) => s + hours[k], 0), selected: monday === week.monday, partial: data.today >= monday && data.today <= sunday });
  }
  if (!weeks.length) return null;
  const band = { min: WEEKLY_HOURS_MIN, max: data.profile.workout_settings.weekly_hours_max };
  const complete = weeks.filter((w) => !w.partial);
  return {
    weeks,
    sports: SPORTS.filter((s) => weeks.some((w) => w.hours[s] > 0)),
    band,
    selected: weeks.at(-1)!,
    avg: mean(complete.map((w) => w.total)),
    inBand: complete.filter((w) => w.total >= band.min && w.total <= band.max).length,
    complete: complete.length,
  };
}

// ---------- Planned vs done ----------

/** done: that sport that day. moved: that sport within two days instead. swapped: another sport
 * that day. missed: nothing that day. today / upcoming: not due yet. */
export type PlanStatus = "done" | "moved" | "swapped" | "missed" | "today" | "upcoming";

export interface PlanItem {
  session: PlannedWorkout;
  sport: ActiveSport | null;
  status: PlanStatus;
  /** The activity that did it (done, moved) or replaced it (swapped). */
  activity: Activity | null;
}

export interface DayPlan {
  date: LocalDate;
  restDay: boolean;
  planned: PlanItem[];
  /** Sessions planned for another day, done on this one. */
  movedIn: { activity: Activity; from: LocalDate }[];
  /** Activities that matched nothing planned. */
  extras: Activity[];
}

export interface PlanVsDone {
  days: DayPlan[];
  /** Any session planned this week (rest days aside). */
  hasPlan: boolean;
  plannedMinutes: number;
  doneMinutes: number;
  /** Sessions whose day has come (today's counts once it's done). */
  due: number;
  done: number;
  swapped: number;
  missed: number;
  extras: number;
}

const MOVE_DAYS = 2;

export function planVsDone(data: Pick<DashboardData, "activities" | "planned" | "today">, week: ProgressWeek): PlanVsDone {
  const activities = data.activities.filter((a) => inDays(a.local_date, week.monday, week.sunday));
  const used = new Set<string>();
  const sessions = data.planned
    .filter((s) => !s.rest_day && inDays(s.local_date, week.monday, week.sunday))
    .map((session): PlanItem => ({ session, sport: sessionSport(session), status: "upcoming", activity: null }));
  const take = (match: (a: Activity) => boolean) => {
    const a = activities.find((x) => !used.has(x.id) && match(x));
    if (a) used.add(a.id);
    return a ?? null;
  };

  // Same sport, same day first; then the same sport a day or two either side, once the
  // session's own day is over (until then it's still on, and an early one stays an extra).
  for (const item of sessions) {
    const a = item.sport && take((x) => x.local_date === item.session.local_date && sportOf(x.activity_type) === item.sport);
    if (a) Object.assign(item, { status: "done", activity: a });
  }
  for (const item of sessions) {
    if (item.activity || !item.sport || item.session.local_date >= data.today) continue;
    const a = take((x) => sportOf(x.activity_type) === item.sport && Math.abs(diffDays(x.local_date, item.session.local_date)) <= MOVE_DAYS);
    if (a) Object.assign(item, { status: "moved", activity: a });
  }
  // What's left: another sport that day, or nothing. Today's stays open until the day is over.
  for (const item of sessions) {
    if (item.activity) continue;
    const date = item.session.local_date;
    if (date > data.today) continue;
    const a = take((x) => x.local_date === date);
    if (a) Object.assign(item, { status: "swapped", activity: a });
    else item.status = date === data.today ? "today" : "missed";
  }

  const days = week.days.map((date): DayPlan => {
    const rows = data.planned.filter((s) => s.local_date === date);
    const planned = sessions.filter((s) => s.session.local_date === date);
    return {
      date,
      restDay: planned.length === 0 && rows.some((s) => s.rest_day),
      planned,
      movedIn: sessions.flatMap((s) => (s.status === "moved" && s.activity!.local_date === date ? [{ activity: s.activity!, from: s.session.local_date }] : [])),
      extras: activities.filter((a) => a.local_date === date && !used.has(a.id)),
    };
  });
  const count = (status: PlanStatus) => sessions.filter((s) => s.status === status).length;
  return {
    days,
    hasPlan: sessions.length > 0,
    plannedMinutes: Math.round(sessions.reduce((sum, s) => sum + (s.session.duration_s ?? 0), 0) / 60),
    doneMinutes: Math.round(activities.reduce((sum, a) => sum + (a.moving_duration_s ?? a.duration_s), 0) / 60),
    due: sessions.length - count("upcoming") - count("today"),
    done: count("done") + count("moved"),
    swapped: count("swapped"),
    missed: count("missed"),
    extras: days.reduce((sum, d) => sum + d.extras.length, 0),
  };
}

// ---------- Recovery and mood ----------

export interface RecoveryDay {
  date: LocalDate;
  /** After today: nothing to show yet. */
  future: boolean;
  readiness: number | null;
  sleep: number | null;
  /** Garmin's HRV status word ("BALANCED", "UNBALANCED", "LOW"...). */
  hrv: string | null;
  /** Body Battery on waking. */
  battery: number | null;
}

export interface WeekRecovery {
  days: RecoveryDay[];
  avgReadiness: number | null;
  avgSleep: number | null;
  /** Days with an HRV status, and how many of them were balanced. */
  hrvDays: number;
  balanced: number;
}

export function weekRecovery(data: Pick<DashboardData, "recovery" | "sleep" | "today">, week: ProgressWeek): WeekRecovery | null {
  const days = week.days.map((date): RecoveryDay => {
    const r = data.recovery.find((x) => x.local_date === date);
    const night = data.sleep.find((x) => x.local_date === date);
    return {
      date,
      future: date > data.today,
      readiness: r ? readinessOf(r) : null,
      sleep: night?.score ?? null,
      hrv: r?.hrv_status ?? null,
      battery: r?.body_battery_wake ?? null,
    };
  });
  if (!days.some((d) => d.readiness !== null || d.sleep !== null || d.hrv !== null)) return null;
  const hrv = days.flatMap((d) => (d.hrv ? [d.hrv] : []));
  return {
    days,
    avgReadiness: mean(days.flatMap((d) => (d.readiness === null ? [] : [d.readiness]))),
    avgSleep: mean(days.flatMap((d) => (d.sleep === null ? [] : [d.sleep]))),
    hrvDays: hrv.length,
    balanced: hrv.filter((s) => s.toUpperCase() === "BALANCED").length,
  };
}

export interface WeekMood {
  days: { date: LocalDate; future: boolean; log: MoodLog | null }[];
  logged: number;
  /** Days so far this week (7 for a past week). */
  span: number;
  avgMood: number | null;
  avgEnergy: number | null;
}

export function weekMood(data: Pick<DashboardData, "moodLogs" | "today">, week: ProgressWeek): WeekMood {
  const days = week.days.map((date) => ({ date, future: date > data.today, log: data.moodLogs.find((l) => l.local_date === date) ?? null }));
  const logs = days.flatMap((d) => (d.log ? [d.log] : []));
  return {
    days,
    logged: logs.length,
    span: eachDay(week.monday, week.through).length,
    avgMood: mean(logs.flatMap((l) => (l.mood === null ? [] : [l.mood]))),
    avgEnergy: mean(logs.flatMap((l) => (l.energy === null ? [] : [l.energy]))),
  };
}

// ---------- Easy vs hard ----------

export interface IntensityWeek {
  monday: LocalDate;
  /** Minutes in heart-rate zones 1-2, 3, and 4-5, every sport together. */
  easy: number;
  moderate: number;
  hard: number;
  /** easy ÷ all, null without any zone data that week. */
  easyShare: number | null;
  /** The week holds the day asked about and isn't over. */
  partial: boolean;
}

export interface IntensitySplit {
  weeks: IntensityWeek[];
  /** The picked week's share, and the 4 weeks before it on average. */
  share: number | null;
  priorShare: number | null;
}

const INTENSITY_WEEKS = 8;

/** Time by heart-rate zone per Monday-to-Sunday week, every sport together, for the last
 * INTENSITY_WEEKS through the picked one, against the 80% easy aim (EASY_SHARE_AIM). Garmin's
 * own zones per sport (cycling has its own), from each activity's hr_zone_s. */
export function intensitySplit(data: Pick<DashboardData, "activities">, week: ProgressWeek): IntensitySplit | null {
  const weeks = Array.from({ length: INTENSITY_WEEKS }, (_, i): IntensityWeek => {
    const monday = addDays(week.monday, -7 * (INTENSITY_WEEKS - 1 - i));
    const end = monday === week.monday ? week.through : addDays(monday, 6);
    const z = [0, 0, 0, 0, 0];
    for (const a of data.activities) {
      if (!a.hr_zone_s || !inDays(a.local_date, monday, end)) continue;
      a.hr_zone_s.forEach((s, k) => (z[k] += s / 60));
    }
    const easy = z[0] + z[1];
    const all = z.reduce((x, y) => x + y, 0);
    return {
      monday,
      easy: Math.round(easy),
      moderate: Math.round(z[2]),
      hard: Math.round(z[3] + z[4]),
      easyShare: all > 0 ? easy / all : null,
      partial: monday === week.monday && week.current,
    };
  });
  if (weeks.every((w) => w.easyShare === null)) return null;
  const totals = (ws: IntensityWeek[]) => ws.reduce((t, w) => ({ easy: t.easy + w.easy, all: t.all + w.easy + w.moderate + w.hard }), { easy: 0, all: 0 });
  const prior = totals(weeks.slice(-5, -1));
  return { weeks, share: weeks.at(-1)!.easyShare, priorShare: prior.all > 0 ? prior.easy / prior.all : null };
}

// ---------- Weight ----------

const WEIGHT_WEEKS = 8;

/** The week's weight: the 7-day average at its last day against the end of the week before
 * (down is good: the goal is losing), with the last 8 weeks' ends as the sparkline. */
export function weekWeightCard(data: Pick<DashboardData, "weightTrend">, week: ProgressWeek): KpiValue | null {
  const at = (date: LocalDate) => [...data.weightTrend].reverse().find((r) => r.local_date <= date) ?? null;
  const now = at(week.through);
  if (!now || now.local_date < week.monday) return null;
  const before = at(addDays(week.monday, -1));
  const delta = before ? Math.round((now.avg7_lb - before.avg7_lb) * 10) / 10 : undefined;
  const points = Array.from({ length: WEIGHT_WEEKS }, (_, i) => {
    const end = i === WEIGHT_WEEKS - 1 ? week.through : addDays(week.monday, -1 - 7 * (WEIGHT_WEEKS - 2 - i));
    const row = at(end);
    return row ? [{ date: end, value: row.avg7_lb, text: `${row.avg7_lb.toFixed(1)} lb`, title: fmtPointTitle(mondayOf(end), true) }] : [];
  }).flat();
  return {
    value: Math.round(now.avg7_lb * 10) / 10,
    unit: "lb",
    delta,
    deltaUnit: "lb",
    tone: delta === undefined ? "neutral" : delta < 0 ? "good" : delta > 0.5 ? "warn" : "neutral",
    sub: before ? `7-day average, vs ${before.avg7_lb.toFixed(1)} at the end of last week` : "7-day average",
    points,
  };
}
