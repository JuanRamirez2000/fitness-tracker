import type { Activity } from "@/lib/data/activities";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { intensitySplit, loadCard, planVsDone, weekWeightCard, WEEKLY_HOURS_MIN } from "@/lib/progress/build";
import type { ProgressWeek } from "@/lib/progress/week";
import { METERS_PER_MILE } from "@/lib/running/runs";
import { isRide, isRun, sportOf, SPORTS, type ActiveSport } from "@/lib/sport";
import { trainingStatus } from "@/lib/charts/training";
import { readinessBand } from "@/lib/today/hero";
import { planLabel, plannedMinutes, sessionSport } from "@/lib/workouts/plan";
import type { DashboardData, KpiTone } from "./types";

/**
 * Each tab's "week so far": a row of small tiles about that tab, for the picked week (the
 * header's week picker), through today in the current week. Only tiles with something to say.
 * Pure, unit-tested (week-so-far.test.ts).
 */

export interface WeekTile {
  key: string;
  label: string;
  value: string;
  sub: string;
  tone: KpiTone;
  sport?: ActiveSport | null;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayName = (date: string) => WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
const inWeek = (date: LocalDate, week: ProgressWeek) => date >= week.monday && date <= week.through;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const hoursOf = (as: Activity[]) => as.reduce((s, a) => s + (a.moving_duration_s ?? a.duration_s), 0) / 3600;
const h = (n: number) => `${n.toFixed(1)} h`;
const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}`;

function weekActivities(data: Pick<DashboardData, "activities">, week: ProgressWeek) {
  return data.activities.filter((a) => inWeek(a.local_date, week));
}

/** Home: is the plan on track this week? */
export function homeTiles(data: Pick<DashboardData, "activities" | "planned" | "planHistory" | "today" | "profile">, week: ProgressWeek): WeekTile[] {
  const acts = weekActivities(data, week);
  const hours = hoursOf(acts);
  const max = data.profile.workout_settings.weekly_hours_max;
  const tiles: WeekTile[] = [
    {
      key: "hours",
      label: "Training time",
      value: h(hours),
      sub: `aim ${WEEKLY_HOURS_MIN}–${max} h`,
      tone: hours > max ? "warn" : hours >= WEEKLY_HOURS_MIN ? "good" : "neutral",
    },
  ];
  const plan = planVsDone({ activities: data.activities, planned: data.planned, today: data.today }, week);
  if (plan.hasPlan) {
    const items = plan.days.flatMap((d) => d.planned);
    const key = items.filter((i) => i.session.key_workout && i.status !== "upcoming" && i.status !== "today");
    const keyDone = key.filter((i) => i.status === "done" || i.status === "moved").length;
    const left = items.filter((i) => i.status === "upcoming" || i.status === "today").length;
    tiles.push({
      key: "sessions",
      label: "Sessions done",
      value: plan.due ? `${plan.done} of ${plan.due}` : "None due",
      sub: [key.length ? `${keyDone} of ${key.length} key` : "", left ? `${left} to go` : ""].filter(Boolean).join(" · ") || "every session done",
      tone: plan.missed > 0 ? "warn" : plan.due ? "good" : "neutral",
    });
  }
  const load = loadCard(data.activities, week);
  tiles.push({
    key: "load",
    label: week.current ? "Load so far" : "Load",
    value: String(load.value),
    sub: load.delta === undefined ? load.sub : `${signed(load.delta, "%")} vs last week`,
    tone: load.tone,
  });
  if (week.current) {
    const doneToday = new Set(data.activities.filter((a) => a.local_date === data.today).map((a) => sportOf(a.activity_type)));
    const next = data.planHistory.find((s) => !s.rest_day && s.local_date >= data.today && !(s.local_date === data.today && doneToday.has(sessionSport(s) ?? "other")));
    if (next) {
      tiles.push({
        key: "next",
        label: next.local_date === data.today ? "Next · today" : `Next · ${dayName(next.local_date)}`,
        value: next.name ?? "Workout",
        sub: [plannedMinutes(next), planLabel(next), next.key_workout ? "key" : ""].filter(Boolean).join(" · "),
        tone: "neutral",
        sport: sessionSport(next),
      });
    }
  }
  return tiles;
}

/** Training: how much, of what, and how hard. */
export function trainingTiles(data: Pick<DashboardData, "activities" | "training">, week: ProgressWeek): WeekTile[] {
  const acts = weekActivities(data, week);
  const bySport = SPORTS.flatMap((s) => {
    const hours = hoursOf(acts.filter((a) => sportOf(a.activity_type) === s));
    return hours > 0 ? [`${s} ${hours.toFixed(1)}`] : [];
  });
  const runs = acts.filter(isRun);
  const rides = acts.filter(isRide);
  const tiles: WeekTile[] = [
    { key: "time", label: "Training time", value: h(hoursOf(acts)), sub: bySport.join(" · ") || "nothing yet", tone: "neutral" },
    {
      key: "run",
      label: "Run miles",
      value: (runs.reduce((s, r) => s + (r.distance_m ?? 0), 0) / METERS_PER_MILE).toFixed(1),
      sub: `${runs.length} run${runs.length === 1 ? "" : "s"}`,
      tone: "neutral",
      sport: "run",
    },
    { key: "ride", label: "Ride time", value: h(hoursOf(rides)), sub: `${rides.length} ride${rides.length === 1 ? "" : "s"}`, tone: "neutral", sport: "ride" },
  ];
  const split = intensitySplit(data, week);
  if (split?.share != null) {
    tiles.push({ key: "easy", label: "Easy share", value: `${Math.round(split.share * 100)}%`, sub: "aim 80% easy", tone: split.share >= 0.8 ? "good" : "warn" });
  }
  const last = [...data.training].reverse().find((t) => t.local_date <= week.through && t.acwr !== null);
  if (last && last.local_date >= addDays(week.through, -3)) {
    const status = trainingStatus(last.status);
    const ok = last.acwr! >= 0.8 && last.acwr! <= 1.5;
    tiles.push({ key: "ratio", label: "Load ratio", value: last.acwr!.toFixed(1), sub: status?.label ?? (ok ? "healthy" : "out of range"), tone: ok ? "good" : "warn" });
  }
  return tiles;
}

/** Recovery: how the week's mornings, nights and moods went. */
export function recoveryTiles(data: Pick<DashboardData, "recovery" | "sleep" | "moodLogs" | "heatmap">, week: ProgressWeek): WeekTile[] {
  const tiles: WeekTile[] = [];
  const mornings = data.recovery.flatMap((r) => {
    const v = r.readiness_morning_score ?? r.readiness_score;
    return inWeek(r.local_date, week) && v !== null ? [v] : [];
  });
  const readiness = mean(mornings);
  if (readiness !== null) {
    const band = readinessBand(readiness);
    tiles.push({ key: "readiness", label: "Readiness", value: String(Math.round(readiness)), sub: `average of ${mornings.length} morning${mornings.length === 1 ? "" : "s"}`, tone: band === "good" ? "good" : band === "bad" ? "bad" : "warn" });
  }
  const nights = data.sleep.filter((n) => inWeek(n.local_date, week) && (n.duration_s ?? 0) > 0);
  const score = mean(nights.flatMap((n) => (n.score === null ? [] : [n.score])));
  if (nights.length) {
    tiles.push({
      key: "sleep",
      label: "Sleep",
      value: score === null ? h(mean(nights.map((n) => n.duration_s! / 3600))!) : String(Math.round(score)),
      sub: `${mean(nights.map((n) => n.duration_s! / 3600))!.toFixed(1)} h a night`,
      tone: score === null ? "neutral" : score >= 80 ? "good" : score < 60 ? "warn" : "neutral",
    });
  }
  // Debt over the 7 nights to the week's last day: hours short of Garmin's sleep need.
  const last7 = data.sleep.filter((n) => n.local_date > addDays(week.through, -7) && n.local_date <= week.through && n.need_s !== null && n.duration_s !== null);
  if (last7.length) {
    const debt = last7.reduce((s, n) => s + Math.max(0, n.need_s! - n.duration_s!), 0) / 3600;
    tiles.push({ key: "debt", label: "Sleep debt", value: h(debt), sub: `last ${last7.length} nights`, tone: debt > 7 ? "warn" : debt < 3 ? "good" : "neutral" });
  }
  const moods = data.moodLogs.filter((m) => inWeek(m.local_date, week));
  const mood = mean(moods.flatMap((m) => (m.mood === null ? [] : [m.mood])));
  if (mood !== null) {
    tiles.push({ key: "mood", label: "Mood", value: `${mood.toFixed(1)} / 5`, sub: `${moods.length} log${moods.length === 1 ? "" : "s"}${moods.some((m) => m.sick || m.injured) ? " · sick or hurt" : ""}`, tone: mood >= 3.5 ? "good" : mood < 2.5 ? "warn" : "neutral" });
  }
  const steps = mean(data.heatmap.steps.filter((s) => inWeek(s.local_date, week)).map((s) => s.steps));
  if (steps !== null) tiles.push({ key: "steps", label: "Steps", value: `${(steps / 1000).toFixed(1)}k`, sub: "a day on average", tone: steps >= 10000 ? "good" : "neutral" });
  return tiles;
}

/** Weight: where the 7-day average is, and how fast it's moving toward the goal. */
export function weightTiles(data: Pick<DashboardData, "weightTrend" | "profile" | "firstWeighIn">, week: ProgressWeek): WeekTile[] {
  const tiles: WeekTile[] = [];
  const card = weekWeightCard(data, week);
  if (card) {
    tiles.push({
      key: "avg",
      label: "7-day average",
      value: `${card.value!.toFixed(1)} lb`,
      sub: card.delta === undefined ? "no reading last week" : `${signed(card.delta, " lb")} this week`,
      tone: card.tone,
    });
  }
  const weighIns = data.weightTrend.filter((r) => inWeek(r.local_date, week)).length;
  tiles.push({ key: "count", label: "Weigh-ins", value: String(weighIns), sub: `of ${week.days.filter((d) => d <= week.through).length} days`, tone: weighIns >= 5 ? "good" : "neutral" });
  const pace = data.profile.goal_pace_lb_per_week;
  if (card?.delta !== undefined && pace) {
    const lost = -card.delta;
    tiles.push({ key: "rate", label: "Rate vs plan", value: `${lost >= 0 ? "−" : "+"}${Math.abs(lost).toFixed(1)} lb`, sub: `plan −${pace} lb a week`, tone: lost >= pace * 0.75 && lost <= pace * 1.5 ? "good" : lost > pace * 1.5 ? "warn" : "neutral" });
  }
  const start = data.profile.start_weight_lb ?? data.firstWeighIn?.weight_lb ?? null;
  const goal = data.profile.goal_weight_lb;
  if (card && start !== null && goal !== null && start > goal) {
    const share = Math.max(0, Math.min(1, (start - card.value!) / (start - goal)));
    tiles.push({ key: "goal", label: "Progress to goal", value: `${Math.round(share * 100)}%`, sub: `${(card.value! - goal).toFixed(1)} lb to go`, tone: "neutral" });
  }
  return tiles;
}

/** Log: what got recorded this week. */
export function logTiles(data: Pick<DashboardData, "activities" | "weightTrend" | "moodLogs" | "sleep" | "recovery">, week: ProgressWeek): WeekTile[] {
  const days = week.days.filter((d) => d <= week.through).length;
  const count = (n: number, label: string, of = true): WeekTile => ({ key: label, label, value: String(n), sub: of ? `of ${days} days` : "this week", tone: "neutral" });
  return [
    count(weekActivities(data, week).length, "Activities", false),
    count(data.weightTrend.filter((r) => inWeek(r.local_date, week)).length, "Weigh-ins"),
    count(data.moodLogs.filter((m) => inWeek(m.local_date, week)).length, "Mood logs"),
    count(data.sleep.filter((n) => inWeek(n.local_date, week) && (n.duration_s ?? 0) > 0).length, "Nights of sleep"),
    count(data.recovery.filter((r) => inWeek(r.local_date, week) && (r.readiness_morning_score ?? r.readiness_score) !== null).length, "Readiness mornings"),
  ];
}
