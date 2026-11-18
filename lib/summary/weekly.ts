/**
 * The Progress tab's weekly review: one Monday-to-Sunday week -> a headline plus short Wins /
 * Watch out / Next week sections from Gemini -> weekly_summaries. The morning cron writes the
 * current week's "so far" review Tuesday to Sunday and, on Monday, the finished week's final
 * one; the owner's Refresh does the same for the day it is. Same rules as the other summaries
 * (lib/summary/generate.ts): plain words, effect and what to do, a few rounded numbers, no
 * HRV-ms or weight numbers.
 *
 * No server-only guard: scripts/summary-generate.ts runs this from the command line too.
 */
import { typeLabel } from "../activity/view";
import { findBricks } from "../charts/bricks";
import type { DashboardData } from "../dashboard/types";
import { activityRowSchema, type Activity } from "../data/activities";
import { moodLogRowSchema, MOOD_SCALE_WORDS } from "../data/mood";
import { plannedWorkoutRowSchema, type PlannedWorkout } from "../data/planned";
import { profileSchema, type Profile } from "../data/profiles";
import { dailyRecoveryRowSchema, sleepNightRowSchema, weeklySectionsSchema, type WeeklySections } from "../data/recovery";
import { addDays, mondayOf, type LocalDate } from "../dates/calendar";
import { weekdayName } from "../dates/format";
import { todayIn } from "../dates/timezone";
import { db } from "../db";
import { countdownCard, loadCard, planVsDone, weekMood, weekRecovery, WEEKLY_HOURS_MIN } from "../progress/build";
import { progressWeek, type ProgressWeek } from "../progress/week";
import { sportOf } from "../sport";
import { planLabel } from "../workouts/plan";
import { callGemini, SUMMARY_MODEL } from "./generate";
import { summaryUserMessage } from "./prompt";

const round1 = (v: number) => Math.round(v * 10) / 10;
const minutes = (a: Activity) => Math.round((a.moving_duration_s ?? a.duration_s) / 60);
const inWeek = (date: LocalDate, from: LocalDate, to: LocalDate) => date >= from && date <= to;

/** Which week the morning run (and Refresh) writes on a given day: on Monday the week just
 * finished, final; any other day the current week so far. */
export function weeklyTarget(today: LocalDate): { monday: LocalDate; final: boolean } {
  const current = mondayOf(today);
  return current === today ? { monday: addDays(current, -7), final: true } : { monday: current, final: false };
}

export type WeeklyInput = Pick<DashboardData, "activities" | "recovery" | "sleep" | "moodLogs" | "today" | "profile"> & {
  week: ProgressWeek;
  final: boolean;
  /** Planned sessions from the week's Monday through the Sunday after it. */
  planned: PlannedWorkout[];
};

/**
 * The week's facts in words: training against the week before and the 4–7 h band, the plan
 * against what was done, the mornings and the mood log, the race, and what's planned next.
 * Only what exists. Pure, unit-tested.
 */
export function weeklyFacts(input: WeeklyInput): Record<string, unknown> {
  const { week, today } = input;
  const facts: Record<string, unknown> = {
    week: { monday: week.monday, sunday: week.sunday, status: input.final ? "finished" : `so far, through ${weekdayName(week.through)}` },
  };

  const done = input.activities.filter((a) => inWeek(a.local_date, week.monday, week.through));
  const hours = (as: Activity[]) => round1(as.reduce((sum, a) => sum + (a.moving_duration_s ?? a.duration_s), 0) / 3600);
  const prior4 = Array.from({ length: 4 }, (_, i) => {
    const monday = addDays(week.monday, -7 * (i + 1));
    return hours(input.activities.filter((a) => inWeek(a.local_date, monday, addDays(monday, 6))));
  });
  const load = loadCard(input.activities, week);
  const bricks = findBricks(done).length;
  facts.training = {
    sessions: done.map((a) => ({
      day: weekdayName(a.local_date),
      what: a.name ?? typeLabel(a.activity_type),
      sport: sportOf(a.activity_type),
      minutes: minutes(a),
      ...(a.training_load !== null ? { garmin_load: Math.round(a.training_load) } : {}),
    })),
    hours: hours(done),
    weekly_hours_aim: `${WEEKLY_HOURS_MIN} to ${input.profile.workout_settings.weekly_hours_max}`,
    average_hours_the_4_weeks_before: round1(prior4.reduce((a, b) => a + b, 0) / 4),
    garmin_load: load.value,
    ...(load.delta !== undefined ? { load_change_vs_the_week_before_percent: load.delta } : {}),
    ...(load.tone === "warn" ? { load_jump_flag: "up more than 15% on the week before, more than is usually safe to add" } : {}),
    ...(bricks ? { bricks_run_straight_off_a_ride: bricks } : {}),
  };

  const plan = planVsDone({ activities: input.activities, planned: input.planned, today }, week);
  if (plan.hasPlan) {
    const items = plan.days.flatMap((d) => d.planned);
    const named = (status: string) =>
      items.filter((i) => i.status === status).map((i) => `${weekdayName(i.session.local_date)} ${i.session.name ?? "workout"}`);
    facts.plan = {
      source: planSource(items.map((i) => i.session)),
      sessions_due: plan.due,
      done: plan.done,
      ...(named("moved").length ? { done_on_another_day: named("moved") } : {}),
      ...(named("swapped").length ? { swapped_for_something_else: named("swapped") } : {}),
      ...(named("missed").length ? { missed: named("missed") } : {}),
      ...(plan.extras ? { extra_sessions_not_on_the_plan: plan.extras } : {}),
      planned_hours: round1(plan.plannedMinutes / 60),
    };
  }

  const recovery = weekRecovery(input, week);
  if (recovery) {
    const before = weekRecovery(input, progressWeek(addDays(week.monday, -7), today));
    const days = recovery.days.filter((d) => d.readiness !== null);
    const low = days.length ? days.reduce((a, b) => (b.readiness! < a.readiness! ? b : a)) : null;
    facts.recovery = {
      ...(recovery.avgReadiness !== null ? { average_training_readiness: Math.round(recovery.avgReadiness) } : {}),
      ...(before?.avgReadiness != null ? { average_readiness_the_week_before: Math.round(before.avgReadiness) } : {}),
      ...(low && low.readiness! < 50 ? { lowest_readiness: `${low.readiness} on ${weekdayName(low.date)}` } : {}),
      ...(recovery.avgSleep !== null ? { average_sleep_score: Math.round(recovery.avgSleep) } : {}),
      ...(recovery.hrvDays ? { hrv_status_balanced_days: `${recovery.balanced} of ${recovery.hrvDays}` } : {}),
    };
  }

  const mood = weekMood(input, week);
  if (mood.logged) {
    const logs = mood.days.flatMap((d) => (d.log ? [d.log] : []));
    const avgWord = (k: "mood" | "energy" | "soreness" | "motivation") => {
      const vs = logs.flatMap((l) => (l[k] === null ? [] : [l[k]!]));
      if (!vs.length) return undefined;
      const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
      return `${MOOD_SCALE_WORDS[k][Math.round(avg) - 1]} (${round1(avg)} of 5)`;
    };
    const sick = logs.filter((l) => l.sick).map((l) => weekdayName(l.local_date));
    const injured = logs.filter((l) => l.injured).map((l) => weekdayName(l.local_date));
    const areas = [...new Set(logs.flatMap((l) => l.sore_areas))];
    facts.how_they_felt = {
      days_logged: `${mood.logged} of ${mood.span}`,
      ...Object.fromEntries((["mood", "energy", "soreness", "motivation"] as const).flatMap((k) => (avgWord(k) ? [[`average_${k}`, avgWord(k)]] : []))),
      ...(sick.length ? { sick_days: sick } : {}),
      ...(injured.length ? { injured_days: injured } : {}),
      ...(areas.length ? { sore_areas: areas } : {}),
    };
  }

  const countdown = countdownCard(input, week);
  const race = input.profile.workout_settings.race;
  if (countdown && race && countdown.value !== null) {
    facts.race = { name: race.name, date: race.date, weeks_to_go: countdown.value, training_phase: countdown.deltaText };
  }

  // What's next: the rest of this week (so far) or the week ahead (final).
  const from = input.final ? addDays(week.sunday, 1) : addDays(today, 1);
  const to = input.final ? addDays(week.sunday, 7) : week.sunday;
  const upcoming = input.planned.filter((s) => inWeek(s.local_date, from, to) && !s.rest_day);
  if (upcoming.length) {
    facts[input.final ? "next_week_planned" : "rest_of_week_planned"] = upcoming.map((s) => ({
      day: weekdayName(s.local_date),
      what: s.name ?? "workout",
      ...(s.duration_s ? { minutes: Math.round(s.duration_s / 60) } : {}),
      from: s.source === "self" ? "their own workout" : planLabel(s) === "Runna" ? "Runna" : planLabel(s) === "Coach" ? "Garmin Coach" : "Garmin calendar",
      ...(s.key_workout ? { key_session: true } : {}),
    }));
  }
  return facts;
}

/** Where the week's plan came from, in words: "Runna running plan, plus their own ride and swim workouts". */
function planSource(sessions: PlannedWorkout[]): string {
  const plans = [...new Set(sessions.filter((s) => s.source !== "self").map((s) => (planLabel(s) === "Runna" ? "Runna running plan" : planLabel(s) === "Coach" ? "Garmin Coach plan" : "Garmin calendar workouts")))];
  const own = [...new Set(sessions.filter((s) => s.source === "self").map((s) => s.sport ?? "workout"))];
  const parts = [plans.join(" and "), own.length ? `their own ${own.join(" and ")} workouts` : ""].filter(Boolean);
  return parts.join(", plus ");
}

/** Enough to review: any training, any planned session, or a morning's readiness. */
export function hasEnoughForWeekly(facts: Record<string, unknown>): boolean {
  const training = facts.training as { sessions?: unknown[] } | undefined;
  return Boolean(training?.sessions?.length) || "plan" in facts || "recovery" in facts;
}

export const WEEKLY_SYSTEM = `You write the weekly review at the top of the Progress tab of one person's fitness dashboard. They're training toward a sprint triathlon in April 2027: running on a Runna plan, plus rides (indoors on a Wahoo Kickr and outdoors) and pool swims they plan around it, 4 to 7 hours a week. They read this once to know how the week went and what to do about it, not to re-read the numbers.

Answer as JSON:
- "headline": one plain sentence, at most 15 words, that sums up the week (it is also the subject of an email).
- "wins": 1 or 2 short sentences, what went well (sessions done, consistency, recovery holding up, a brick, a good mood week).
- "watch": 1 or 2 short sentences, what to keep an eye on and why it matters (missed or swapped sessions, a load jump, low readiness or sleep, low mood or energy, soreness, sickness). If nothing stands out, one sentence saying so.
- "next": 1 or 2 short sentences, what to do next: the key planned sessions by day and how to approach them given this week. When the week is "so far", this covers the rest of the week; when "finished", the week ahead.

Speak to them as "you", no greeting, lists inside sentences, or emoji. Use at most three rounded numbers in the whole review, only ones in the data, and explain what they mean (hours against the 4 to 7 hour aim, a load jump, readiness). Never give HRV in milliseconds or anything about body weight. A session done on another day counts as done. When the week is "so far", judge it as unfinished: say what's left rather than calling sessions missed that are still to come. Leave out anything that isn't in the data. This is a training log, not medical advice.`;

const WEEKLY_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    watch: { type: "array", items: { type: "string" } },
    next: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "wins", "watch", "next"],
};

/** A structured answer -> headline and sections (each trimmed to two items); null when it isn't
 * valid JSON of that shape. */
export function parseWeeklyAnswer(text: string): { headline: string; sections: WeeklySections } | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const sections = weeklySectionsSchema.safeParse(parsed);
    if (!headline || !sections.success) return null;
    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).slice(0, 2);
    return { headline, sections: { wins: clean(sections.data.wins), watch: clean(sections.data.watch), next: clean(sections.data.next) } };
  } catch {
    return null;
  }
}

export interface WeeklyResult {
  week: LocalDate;
  final: boolean;
  headline: string | null;
  model: string | null;
  skipped?: string;
}

export interface WeeklyOptions {
  /** Defaults to weeklyTarget(today). */
  target?: { monday: LocalDate; final: boolean };
  dryRun?: boolean;
  log?: (line: string) => void;
  model?: string;
  fetch?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}

/** Writes (or, with dryRun, prints) one week's review. Never throws for a Gemini failure: the
 * result says why nothing was written. */
export async function writeWeeklySummary(options: WeeklyOptions = {}): Promise<WeeklyResult> {
  const { dryRun = false, log = () => {} } = options;
  const sql = db();
  const [row] = await sql`select * from profiles order by created_at limit 1`;
  if (!row) throw new Error("No profile row in the database yet. Run `npm run db:import` first.");
  const profile: Profile = profileSchema.parse(row);
  const today = todayIn(profile.timezone);
  const target = options.target ?? weeklyTarget(today);
  const week = progressWeek(target.monday, today);
  const final = target.final && !week.current;

  // Activities back four weeks before (the hours average and the load comparison), the mornings
  // from the week before (readiness comparison), and planned sessions through the next Sunday.
  const [activities, recovery, sleep, moodLogs, planned] = await Promise.all([
    sql`select * from activities where user_id = ${profile.id} and local_date between ${addDays(week.monday, -28)} and ${week.sunday} order by started_at`,
    sql`select * from daily_recovery where user_id = ${profile.id} and local_date between ${addDays(week.monday, -7)} and ${week.sunday} order by local_date`,
    sql`select * from sleep_nights where user_id = ${profile.id} and local_date between ${addDays(week.monday, -7)} and ${week.sunday} order by local_date`,
    sql`select * from mood_logs where user_id = ${profile.id} and local_date between ${week.monday} and ${week.sunday} order by local_date`,
    sql`select * from planned_workouts where user_id = ${profile.id} and local_date between ${week.monday} and ${addDays(week.sunday, 7)} order by local_date, workout_uuid`,
  ]);
  const facts = weeklyFacts({
    week,
    final,
    today,
    profile,
    activities: activities.map((r) => activityRowSchema.parse(r)),
    recovery: recovery.map((r) => dailyRecoveryRowSchema.parse(r)),
    sleep: sleep.map((r) => sleepNightRowSchema.parse(r)),
    moodLogs: moodLogs.map((r) => moodLogRowSchema.parse(r)),
    planned: planned.map((r) => plannedWorkoutRowSchema.parse(r)),
  });
  log(`[weekly] facts for ${week.monday}${final ? " (final)" : " (so far)"}: ${JSON.stringify(facts)}`);
  const base = { week: week.monday, final };
  if (!hasEnoughForWeekly(facts)) {
    log("[weekly] no training, plan or readiness this week; nothing written.");
    return { ...base, headline: null, model: null, skipped: "no training, plan or readiness this week" };
  }

  const model = options.model ?? SUMMARY_MODEL;
  let call: Awaited<ReturnType<typeof callGemini>>;
  try {
    call = await callGemini(model, WEEKLY_SYSTEM, summaryUserMessage(facts), options.fetch ?? fetch, options.wait, WEEKLY_RESPONSE_SCHEMA);
  } catch (err) {
    call = { skipped: err instanceof Error ? err.message : String(err) };
  }
  if ("skipped" in call) {
    log(`[weekly] ${call.skipped}; nothing written.`);
    return { ...base, headline: null, model, skipped: call.skipped };
  }
  const answer = parseWeeklyAnswer(call.text);
  if (!answer) {
    log("[weekly] the answer wasn't the expected JSON; nothing written.");
    return { ...base, headline: null, model, skipped: "the answer wasn't the expected JSON" };
  }
  log(`[weekly] ${call.modelVersion}: ${answer.headline}\n${JSON.stringify(answer.sections)}`);
  if (!dryRun) {
    // A rewrite keeps emailed_at, so a retried Monday run doesn't send the email twice.
    await sql`
      insert into weekly_summaries (user_id, week_start, final, headline, sections, model, generated_at)
      values (${profile.id}, ${week.monday}, ${final}, ${answer.headline}, ${sql.json(answer.sections)}, ${call.modelVersion}, now())
      on conflict (user_id, week_start)
      do update set final = excluded.final, headline = excluded.headline, sections = excluded.sections,
                    model = excluded.model, generated_at = excluded.generated_at`;
  }
  return { ...base, headline: answer.headline, model: call.modelVersion };
}

