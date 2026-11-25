import type { Activity } from "@/lib/data/activities";
import type { LocalDate } from "@/lib/dates/calendar";
import { loadCard, planVsDone, WEEKLY_HOURS_MIN } from "@/lib/progress/build";
import type { ProgressWeek } from "@/lib/progress/week";
import { sportOf, type ActiveSport } from "@/lib/sport";
import { planLabel, plannedMinutes, sessionSport } from "@/lib/workouts/plan";
import type { DashboardData, KpiTone } from "./types";

/**
 * Home's "This week's training" tiles, for the picked week (the header's week picker), through
 * today in the current week. Only tiles with something to say. Pure, unit-tested
 * (week-so-far.test.ts).
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

