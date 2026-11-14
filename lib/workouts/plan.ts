import { addDays, diffDays, weekdayOf, type LocalDate } from "@/lib/dates/calendar";
import { SPORTS, sportOf, type ActiveSport } from "@/lib/sport";
import type { WorkoutSettings } from "./settings";
import type { Effort, WorkoutRequest } from "./types";

/**
 * The week around a planned workout: which sport the Garmin Coach plan owns, what's on each
 * day, the training phase toward the A race, and suggested sessions for the sports nobody is
 * coaching. One Coach plan owns one sport at a time (cycling now); the tracker supplements the
 * rest, inside the athlete's weekly hour limit. Pure, so the modal and the CLI share it.
 */

/** A planned_workouts row, as much of it as planning needs. */
export interface PlannedSession {
  workout_uuid: string;
  local_date: LocalDate;
  sport: string | null; // Garmin's sportTypeKey for Coach rows; ride | run | swim for own rows
  name: string | null;
  duration_s: number | null;
  rest_day: boolean;
  key_workout: boolean;
  plan_name: string | null;
  source: "garmin" | "self";
}

export interface RecentActivity {
  local_date: LocalDate;
  activity_type: string;
  duration_s: number;
}

export type PhaseKey = "base" | "build" | "taper" | "race" | "recovery" | "offseason" | "none";

export interface Phase {
  key: PhaseKey;
  label: string;
  /** Whole weeks to the race (null without one or after it). */
  weeksToRace: number | null;
  race: { name: string; date: LocalDate } | null;
}

export const BUILD_WEEKS = 14;
export const TAPER_DAYS = 13;

export function phaseOn(today: LocalDate, race: WorkoutSettings["race"]): Phase {
  if (!race) return { key: "none", label: "General fitness", weeksToRace: null, race: null };
  const days = diffDays(race.date, today);
  const weeks = days >= 0 ? Math.floor(days / 7) : null;
  if (days < 0) {
    return -days <= 14
      ? { key: "recovery", label: "Recovering from the race", weeksToRace: null, race }
      : { key: "offseason", label: "Off-season", weeksToRace: null, race };
  }
  if (days === 0) return { key: "race", label: "Race day", weeksToRace: 0, race };
  if (days <= TAPER_DAYS) return { key: "taper", label: "Taper", weeksToRace: weeks, race };
  if (days <= BUILD_WEEKS * 7) return { key: "build", label: "Build", weeksToRace: weeks, race };
  return { key: "base", label: "Base", weeksToRace: weeks, race };
}

/** The tracker's sport for a planned row (Coach rows carry Garmin's key, own rows ours). */
export function sessionSport(s: PlannedSession): ActiveSport | null {
  if (!s.sport) return null;
  if ((SPORTS as readonly string[]).includes(s.sport)) return s.sport as ActiveSport;
  const sport = sportOf(s.sport);
  return sport === "other" ? null : sport;
}

/** Sports a Garmin Coach plan has sessions for from today on. */
export function coachedSports(planned: PlannedSession[], today: LocalDate): ActiveSport[] {
  const set = new Set<ActiveSport>();
  for (const s of planned) {
    if (s.source !== "garmin" || !s.plan_name || s.local_date < today || s.rest_day) continue;
    const sport = sessionSport(s);
    if (sport) set.add(sport);
  }
  return SPORTS.filter((s) => set.has(s));
}

export interface DayInfo {
  date: LocalDate;
  weekday: number;
  coach: PlannedSession[];
  restDay: boolean;
  keyDay: boolean;
  own: PlannedSession[];
  minutes: number;
}

export function daysFrom(today: LocalDate, count: number, planned: PlannedSession[]): DayInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i);
    const rows = planned.filter((s) => s.local_date === date);
    const coach = rows.filter((s) => s.source === "garmin" && !s.rest_day);
    const own = rows.filter((s) => s.source === "self");
    return {
      date,
      weekday: weekdayOf(date),
      coach,
      restDay: rows.some((s) => s.source === "garmin" && s.rest_day) && coach.length === 0,
      keyDay: coach.some((s) => s.key_workout),
      own,
      minutes: Math.round(rows.reduce((sum, s) => sum + (s.duration_s ?? 0), 0) / 60),
    };
  });
}

export interface Suggestion extends WorkoutRequest {
  why: string;
}

export interface WeekPlan {
  today: LocalDate;
  days: DayInfo[];
  coached: ActiveSport[];
  phase: Phase;
  /** Planned minutes over the next 7 days: Coach sessions plus own workouts. */
  weekMinutes: number;
  budgetMinutes: number;
  /** Minutes per week by sport over the last 28 days. */
  recentWeeklyMinutes: Record<ActiveSport, number>;
  /** Longest single session by sport over the last 28 days, in minutes. */
  longestRecent: Record<ActiveSport, number>;
  /** Typical (median) session length by sport over the last 28 days, in minutes. */
  typicalRecent: Record<ActiveSport, number>;
  suggestions: Suggestion[];
}

function zeroBySport(): Record<ActiveSport, number> {
  return { ride: 0, run: 0, swim: 0 };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function round5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekPlan(input: {
  today: LocalDate;
  planned: PlannedSession[];
  recent: RecentActivity[];
  settings: WorkoutSettings;
}): WeekPlan {
  const { today, planned, recent, settings } = input;
  const days = daysFrom(today, 7, planned);
  const coached = coachedSports(planned, today);
  const phase = phaseOn(today, settings.race);
  const weekMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
  const budgetMinutes = Math.round(settings.weekly_hours_max * 60);

  const since = addDays(today, -28);
  const bySport: Record<ActiveSport, number[]> = { ride: [], run: [], swim: [] };
  for (const a of recent) {
    const sport = sportOf(a.activity_type);
    if (sport === "other" || a.local_date < since || a.local_date >= today) continue;
    bySport[sport].push(a.duration_s / 60);
  }
  const recentWeeklyMinutes = zeroBySport();
  const longestRecent = zeroBySport();
  const typicalRecent = zeroBySport();
  for (const sport of SPORTS) {
    recentWeeklyMinutes[sport] = Math.round(bySport[sport].reduce((a, b) => a + b, 0) / 4);
    longestRecent[sport] = Math.round(Math.max(0, ...bySport[sport]));
    typicalRecent[sport] = Math.round(median(bySport[sport]));
  }

  const plan: WeekPlan = {
    today, days, coached, phase, weekMinutes, budgetMinutes, recentWeeklyMinutes, longestRecent, typicalRecent, suggestions: [],
  };
  if (phase.key === "race" || phase.key === "recovery") return plan;

  const taken = new Set<string>(); // `${sport}:${date}` already suggested or planned
  for (const d of days) for (const s of d.own) taken.add(`${sessionSport(s)}:${d.date}`);
  const ownCount = (sport: ActiveSport) => days.reduce((n, d) => n + d.own.filter((s) => sessionSport(s) === sport).length, 0);
  const suggest = (s: Suggestion) => {
    taken.add(`${s.sport}:${s.date}`);
    plan.suggestions.push(s);
  };
  // One Coach rest day a week stays completely off; the first one may carry an easy session.
  const restDays = days.filter((d) => d.restDay && d.own.length === 0);
  const usableRest = restDays.length > 1 ? restDays.slice(0, restDays.length - 1) : [];
  const longRideDay = days.find(
    (d) => settings.long_days.includes(d.weekday) && d.coach.some((s) => sessionSport(s) === "ride" && (s.duration_s ?? 0) >= 75 * 60),
  );
  const dayBeforeKey = (d: DayInfo) => days.find((x) => x.date === addDays(d.date, 1))?.keyDay ?? false;
  const free = (sport: ActiveSport, d: DayInfo) => !taken.has(`${sport}:${d.date}`);

  for (const sport of SPORTS) {
    if (coached.includes(sport)) continue;

    if (sport === "swim") {
      const want = phase.key === "build" ? 2 : 1;
      let left = want - ownCount("swim");
      const swimDays = days.filter((d) => settings.swim_days.includes(d.weekday) && free("swim", d));
      const fallback = days.filter((d) => !d.keyDay && free("swim", d) && !swimDays.includes(d));
      for (const d of [...swimDays, ...fallback]) {
        if (left <= 0) break;
        suggest({
          sport, date: d.date, kind: "auto", effort: 2, minutes: settings.swim_stage === 0 ? 25 : 30,
          why: settings.swim_days.includes(d.weekday)
            ? `Your ${DAY_NAMES[d.weekday]} swim. Short and frequent beats long and rare while you learn.`
            : "A second swim this week: comfort in the water grows fastest with frequent short sessions.",
        });
        left -= 1;
      }
    }

    if (sport === "run") {
      let left = 2 - ownCount("run");
      const easyMinutes = round5(Math.min(40, Math.max(20, typicalRecent.run || 30)));
      const easyDay = [...usableRest, ...days.filter((d) => !d.keyDay && !dayBeforeKey(d) && d.coach.length > 0)].find((d) => free("run", d));
      if (left > 0 && easyDay) {
        suggest({
          sport, date: easyDay.date, kind: "easy", effort: 2, minutes: easyMinutes,
          why: easyDay.restDay
            ? "An easy run on a Coach rest day keeps running in the week without adding bike fatigue. The other rest day stays fully off."
            : "An easy run alongside a lighter Coach ride: keeps your legs used to running.",
        });
        left -= 1;
      }
      if (left > 0 && longRideDay && free("run", longRideDay)) {
        suggest({
          sport, date: longRideDay.date, kind: "brick", effort: phase.key === "build" ? 3 : 2, minutes: phase.key === "build" ? 15 : 10,
          why: "A short brick right after the long ride practices the bike-to-run switch for race day.",
        });
        left -= 1;
      }
      if (left > 0) {
        const d = days.find((x) => free("run", x) && !x.keyDay && !dayBeforeKey(x) && !x.restDay);
        if (d) suggest({
          sport, date: d.date, kind: "strides", effort: 2, minutes: Math.max(25, easyMinutes),
          why: "Easy running with strides keeps leg speed while the bike gets the hard work.",
        });
      }
    }

    if (sport === "ride") {
      let left = 2 - ownCount("ride");
      const weekend = days.find((d) => settings.long_days.includes(d.weekday) && free("ride", d) && !d.keyDay);
      if (left > 0 && weekend) {
        suggest({
          sport, date: weekend.date, kind: "outdoor", effort: 2, minutes: 60,
          why: "An easy outdoor ride on the bike you'll race: handling, shifting and drinking on the move.",
        });
        left -= 1;
      }
      const midweek = [...usableRest, ...days.filter((d) => !d.keyDay && !dayBeforeKey(d))].find((d) => free("ride", d) && !settings.long_days.includes(d.weekday));
      if (left > 0 && midweek) {
        suggest({
          sport, date: midweek.date, kind: "endurance", effort: 2, minutes: 45,
          why: "A steady Kickr ride in ERG keeps your bike fitness while running is coached.",
        });
      }
    }
  }
  plan.suggestions.sort((a, b) => a.date.localeCompare(b.date));
  return plan;
}

/** Plain warnings for one request against the week: hard days, rest days, the hour limit, a
 * session much longer than anything recent, the taper. */
export function warningsFor(request: Pick<WorkoutRequest, "sport" | "date" | "effort" | "minutes">, plan: WeekPlan): string[] {
  const out: string[] = [];
  const day = plan.days.find((d) => d.date === request.date);
  const next = plan.days.find((d) => d.date === addDays(request.date, 1));
  const hard = request.effort >= 4;
  if (day?.keyDay && hard) out.push(`That day already has a key Coach session (${day.coach.find((s) => s.key_workout)?.name ?? "key workout"}). Keep this one easy.`);
  else if (next?.keyDay && hard) out.push(`The next day has a key Coach session (${next.coach.find((s) => s.key_workout)?.name ?? "key workout"}). A hard effort today will blunt it.`);
  if (day?.restDay) out.push("That's a Coach rest day. Fine for something easy, but keep at least one day a week fully off.");
  if (day && day.own.some((s) => sessionSport(s) === request.sport)) out.push(`You already have a ${request.sport} planned that day.`);
  if (day) {
    const total = plan.weekMinutes + request.minutes;
    if (total > plan.budgetMinutes) {
      // Rounded up, so a few minutes over never reads as "7.0 h, over your 7 h limit".
      const hours = (Math.ceil(total / 6) / 10).toFixed(1);
      out.push(`This puts the next 7 days at ${hours} h, over your ${(plan.budgetMinutes / 60).toFixed(0)} h limit. Consider swapping it for part of a Coach session.`);
    }
  }
  const longest = plan.longestRecent[request.sport];
  if (longest > 0 && request.minutes > Math.max(longest * 1.25, longest + 10)) {
    out.push(`Longer than any ${request.sport} in the last 4 weeks (${longest} min). Build up gradually.`);
  }
  if (plan.phase.key === "taper" && hard) out.push("You're in the taper before the race: keep hard efforts short.");
  return out;
}

export function isEffort(n: number): n is Effort {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}
