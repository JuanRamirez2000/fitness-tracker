import { loadRatio } from "@/lib/kpis/load-ratio";
import { sevenDayAverage } from "@/lib/kpis/seven-day-average";
import { sleepDebt } from "@/lib/kpis/sleep-debt";
import { sleepScore } from "@/lib/kpis/sleep-score";
import { weeklyRate } from "@/lib/kpis/weekly-rate";
import { mondayOf } from "@/lib/dates/calendar";
import { countdownCard, planVsDone, WEEKLY_HOURS_MIN } from "@/lib/progress/build";
import { planProgress } from "@/lib/progress/plans";
import { progressWeek } from "@/lib/progress/week";
import { sportOf, type ActiveSport } from "@/lib/sport";
import { buildTodayHero } from "@/lib/today/hero";
import { planLabel, plannedMinutes, sessionSport } from "@/lib/workouts/plan";
import type { DashboardData, KpiTone } from "./types";

/**
 * The quick-look strip at the top of every tab: a handful of small cards, each one number and
 * a few words, each a way into the section behind it. Only cards with something to say are
 * returned. Pure, unit-tested (quick-look.test.ts).
 */

/** Where a card leads: a section of the Training tab, or the Weight tab. */
export type QuickLookTarget = "week" | "next" | "recovery" | "fitness" | "weight";

export interface QuickLookCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  tone: KpiTone;
  /** A wide card (two units) for the plans, which say more. */
  wide?: boolean;
  sport?: ActiveSport | null;
  target: QuickLookTarget | null;
}

type Data = Pick<
  DashboardData,
  "activities" | "recovery" | "sleep" | "training" | "planHistory" | "today" | "profile" | "weightTrend" | "injections" | "dateRange" | "firstWeighIn" | "programStart" | "steps" | "heatmap"
>;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayName = (date: string) => WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];

export function quickLook(data: Data): QuickLookCard[] {
  const cards: QuickLookCard[] = [];
  const week = progressWeek(mondayOf(data.today), data.today);
  const asData = data as DashboardData;

  // Readiness this morning.
  const hero = buildTodayHero(data);
  if (hero.readiness) {
    const r = hero.readiness;
    cards.push({
      key: "readiness",
      label: r.date === data.today ? "Readiness" : `Readiness · ${dayName(r.date)}`,
      value: String(r.score),
      sub: r.label || "Garmin's score",
      tone: r.band === "good" ? "good" : r.band === "bad" ? "bad" : "warn",
      target: "recovery",
    });
  }

  // The next planned session: the plan's, or one of the tracker's own. Today's counts until
  // something of that sport is done today.
  const doneToday = new Set(data.activities.filter((a) => a.local_date === data.today).map((a) => sportOf(a.activity_type)));
  const next = data.planHistory.find((s) => !s.rest_day && s.local_date >= data.today && !(s.local_date === data.today && doneToday.has(sessionSport(s) ?? "other")));
  if (next) {
    cards.push({
      key: "next",
      label: next.local_date === data.today ? "Next · today" : `Next · ${dayName(next.local_date)}`,
      value: next.name ?? "Workout",
      sub: [plannedMinutes(next), planLabel(next), next.key_workout ? "key" : ""].filter(Boolean).join(" · "),
      tone: "neutral",
      sport: sessionSport(next),
      target: "next",
    });
  }

  // Each plan on the Garmin calendar: its week and its goal measure.
  for (const plan of planProgress(data, data.today)) {
    const m = plan.metrics[0];
    cards.push({
      key: `plan:${plan.key}`,
      label: `${plan.who}${plan.week && plan.weeks ? ` · week ${plan.week}/${plan.weeks}` : ""}`,
      value: m ? m.text : `${plan.adherence.done} of ${plan.adherence.due}`,
      sub: m ? `${m.label} · ${m.changeText}` : "sessions done",
      tone: m ? m.tone : "neutral",
      wide: true,
      sport: plan.sport,
      target: "week",
    });
  }

  // This week's hours against the band, and sessions done.
  const minutes = data.activities.reduce((sum, a) => (a.local_date >= week.monday && a.local_date <= week.through ? sum + (a.moving_duration_s ?? a.duration_s) / 60 : sum), 0);
  const max = data.profile.workout_settings.weekly_hours_max;
  const plan = planVsDone({ activities: data.activities, planned: data.planHistory, today: data.today }, week);
  cards.push({
    key: "week",
    label: "This week",
    value: `${(minutes / 60).toFixed(1)} h`,
    sub: [`aim ${WEEKLY_HOURS_MIN}–${max} h`, plan.due ? `${plan.done} of ${plan.due} done` : ""].filter(Boolean).join(" · "),
    tone: minutes / 60 > max ? "warn" : "neutral",
    target: "week",
  });

  const fromKpi = (key: string, label: string, kpi: typeof loadRatio, target: QuickLookTarget, sub?: (s: string) => string) => {
    const v = kpi.compute(asData);
    if (!v) return;
    const f = kpi.format(v);
    cards.push({ key, label, value: f.primary, sub: sub ? sub(f.delta ?? "") : (f.delta ?? v.sub), tone: f.tone ?? v.tone, target });
  };
  fromKpi("load", "Load ratio", loadRatio, "fitness");

  // Weight: the 7-day average and the weekly rate.
  const avg = sevenDayAverage.compute(asData);
  if (avg) {
    const rate = weeklyRate.compute(asData);
    const f = sevenDayAverage.format(avg);
    cards.push({
      key: "weight",
      label: "Weight · 7-day avg",
      value: f.primary,
      sub: rate ? `${weeklyRate.format(rate).primary} a week` : (f.delta ?? avg.sub),
      tone: rate ? (weeklyRate.format(rate).tone ?? rate.tone) : "neutral",
      target: "weight",
    });
  }

  // Last night's sleep, and the debt.
  const score = sleepScore.compute(asData);
  if (score) {
    const debt = sleepDebt.compute(asData);
    cards.push({
      key: "sleep",
      label: "Sleep",
      value: sleepScore.format(score).primary,
      sub: debt ? `debt ${sleepDebt.format(debt).primary}` : score.sub,
      tone: sleepScore.format(score).tone ?? score.tone,
      target: "recovery",
    });
  }

  const race = countdownCard(data, week);
  if (race && race.value !== null) {
    cards.push({ key: "race", label: "Race", value: `${race.value} ${race.unit}`, sub: String(race.deltaText ?? ""), tone: "neutral", target: null });
  }
  return cards;
}
