import type { Activity } from "@/lib/data/activities";
import type { Profile } from "@/lib/data/profiles";
import type { DailyTraining } from "@/lib/data/training";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { buildLoadFocus, buildZoneChart, trainingStatus } from "@/lib/charts/training";
import { fmtRaceTime } from "@/lib/charts/fitness";
import { currentFtp } from "@/lib/kpis/ftp";
import { runMiles, runsIn, runsOf } from "@/lib/running/runs";
import type { PlannedWorkout } from "@/lib/data/planned";
import { isRide, isSwim } from "@/lib/sport";

/** The rows the Training tab's summary is written from. */
export interface TrainingSummaryInput {
  today: LocalDate;
  profile: Pick<Profile, "hr_zone_bounds" | "hr_zone_bounds_cycling">;
  /** Activities from at least the last 14 days, oldest first. */
  activities: Activity[];
  /** Daily training snapshots from at least the last 30 days, oldest first. */
  training: DailyTraining[];
  /** Planned sessions from today on (Garmin Coach or the Garmin calendar), oldest first. */
  planned?: PlannedWorkout[];
}

/** How far ahead the planned sessions in the facts reach. */
const PLAN_DAYS_AHEAD = 7;
/** How far back the best 20-minute power is looked for (the FTP sanity check). */
const POWER_LOOKBACK_DAYS = 90;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const round1 = (v: number) => Math.round(v * 10) / 10;
const onOrBefore = <T extends { local_date: LocalDate }>(rows: T[], date: LocalDate, has: (r: T) => boolean) =>
  [...rows].reverse().find((r) => r.local_date <= date && has(r)) ?? null;

/**
 * The Training tab's facts: the last week of running (volume against the week before, and how
 * much of it was easy), Garmin's load and status, load focus, and the VO2 max and race
 * prediction trend over a month. Only what exists. Pure, unit-tested.
 */
export function trainingFacts(input: TrainingSummaryInput): Record<string, unknown> {
  const { today } = input;
  const facts: Record<string, unknown> = { date: today };
  const lastWeek = { key: "week" as const, from: addDays(today, -6), to: today };

  // Riding first: it's most of their training now.
  const rides = input.activities.filter(isRide);
  const ridesLast7 = runsIn(rides, lastWeek);
  const ridesPrior7 = runsIn(rides, { from: addDays(today, -13), to: addDays(today, -7) });
  if (ridesLast7.length || ridesPrior7.length) {
    const zones = buildZoneChart({ sport: "ride", activities: input.activities, dateRange: lastWeek, today, profile: input.profile });
    const withPower = ridesLast7.filter((r) => r.avg_power_w !== null);
    const hours = (as: typeof rides) => round1(as.reduce((sum, r) => sum + (r.moving_duration_s ?? r.duration_s), 0) / 3600);
    facts.riding_last_7_days = {
      rides: ridesLast7.length,
      indoor_rides: ridesLast7.filter((r) => r.activity_type === "indoor_cycling" || r.activity_type === "virtual_ride").length,
      miles: round1(ridesLast7.reduce((sum, r) => sum + runMiles(r), 0)),
      hours: hours(ridesLast7),
      hours_the_week_before: hours(ridesPrior7),
      climbing_feet: Math.round(ridesLast7.reduce((sum, r) => sum + (r.elevation_gain_m ?? 0), 0) * 3.28084),
      ...(withPower.length
        ? { average_power_watts: Math.round(withPower.reduce((sum, r) => sum + r.avg_power_w!, 0) / withPower.length) }
        : {}),
      ...(zones && zones.totalMinutes > 0 && ridesLast7.every((r) => r.hr_zone_s !== null)
        ? { easy_share_of_time_percent: Math.round(zones.easyShare * 100), easy_share_aim_percent: 80 }
        : {}),
    };
  }

  const runs = runsOf(input.activities);
  const last7 = runsIn(runs, { from: addDays(today, -6), to: today });
  const prior7 = runsIn(runs, { from: addDays(today, -13), to: addDays(today, -7) });
  if (last7.length || prior7.length) {
    const zones = buildZoneChart({
      sport: "run",
      activities: input.activities,
      dateRange: { key: "week", from: addDays(today, -6), to: today },
      today,
      profile: input.profile,
    });
    facts.running_last_7_days = {
      runs: last7.length,
      miles: round1(last7.reduce((sum, r) => sum + runMiles(r), 0)),
      miles_the_week_before: round1(prior7.reduce((sum, r) => sum + runMiles(r), 0)),
      // Only when every run that week has zone data: a share from some of the runs (say, a
      // backfill still in progress) would misstate the week.
      ...(zones && zones.totalMinutes > 0 && last7.every((r) => r.hr_zone_s !== null)
        ? { easy_share_of_time_percent: Math.round(zones.easyShare * 100), easy_share_aim_percent: 80 }
        : {}),
    };
  }

  // Swimming (from 2027): time rather than distance, like every cross-sport measure here.
  const swims = input.activities.filter(isSwim);
  const swimsLast7 = runsIn(swims, lastWeek);
  const swimsPrior7 = runsIn(swims, { from: addDays(today, -13), to: addDays(today, -7) });
  if (swimsLast7.length || swimsPrior7.length) {
    const zones = buildZoneChart({ sport: "swim", activities: input.activities, dateRange: lastWeek, today, profile: input.profile });
    const hours = (as: typeof swims) => round1(as.reduce((sum, r) => sum + (r.moving_duration_s ?? r.duration_s), 0) / 3600);
    facts.swimming_last_7_days = {
      swims: swimsLast7.length,
      hours: hours(swimsLast7),
      hours_the_week_before: hours(swimsPrior7),
      ...(zones && zones.totalMinutes > 0 && swimsLast7.every((r) => r.hr_zone_s !== null)
        ? { easy_share_of_time_percent: Math.round(zones.easyShare * 100), easy_share_aim_percent: 80 }
        : {}),
    };
  }

  // The plan ahead (Garmin Coach): what's coming, so the summary can explain it and say how to
  // approach it. Done sessions are left out.
  const planned = (input.planned ?? []).filter(
    (p) => p.local_date >= today && p.local_date <= addDays(today, PLAN_DAYS_AHEAD) && p.status !== "COMPLETE",
  );
  if (planned.length) {
    facts.upcoming_planned_sessions = planned.map((p) => ({
      date: p.local_date,
      weekday: WEEKDAYS[new Date(`${p.local_date}T12:00:00Z`).getUTCDay()],
      ...(p.rest_day
        ? { rest_day: true }
        : {
            sport: p.sport,
            name: p.name,
            ...(p.description ? { garmin_workout: p.description } : {}),
            ...(p.duration_s ? { minutes: Math.round(p.duration_s / 60) } : {}),
            ...(p.benefit ? { benefit: p.benefit.toLowerCase().replaceAll("_", " ") } : {}),
            ...(p.key_workout ? { key_session: true } : {}),
          }),
    }));
    if (planned[0].plan_name) facts.plan_name = planned[0].plan_name;
  }
  const recentPower = rides.filter((r) => r.local_date > addDays(today, -POWER_LOOKBACK_DAYS) && r.max_20min_power_w !== null);
  if (recentPower.length) facts.best_20_min_power_watts_last_90_days = Math.max(...recentPower.map((r) => r.max_20min_power_w!));

  const load = onOrBefore(input.training, today, (r) => r.acute_load !== null);
  if (load && load.local_date >= addDays(today, -2)) {
    facts.training_load = {
      acute: load.acute_load,
      chronic: load.chronic_load,
      ...(load.chronic_low != null && load.chronic_high != null ? { optimal_chronic_range: [load.chronic_low, load.chronic_high] } : {}),
      ...(load.acwr != null ? { acute_chronic_ratio: load.acwr, healthy_ratio_range: [0.8, 1.5] } : {}),
      ...(load.status ? { status: trainingStatus(load.status)?.label } : {}),
    };
  }

  const focus = buildLoadFocus({ training: input.training, today });
  if (focus && focus.date >= addDays(today, -2)) {
    facts.load_focus_last_4_weeks = Object.fromEntries(
      focus.bars.map((b) => [b.label, { load: Math.round(b.value), target_range: [b.low, b.high], state: b.state === "in" ? "in range" : b.state }]),
    );
  }

  const monthAgo = addDays(today, -30);
  const vo2Now = onOrBefore(input.training, today, (r) => r.vo2max !== null);
  const vo2Then = onOrBefore(input.training, monthAgo, (r) => r.vo2max !== null);
  if (vo2Now) {
    facts.vo2_max = {
      latest: vo2Now.vo2max,
      ...(vo2Then ? { change_last_30_days: round1(vo2Now.vo2max! - vo2Then.vo2max!) } : {}),
    };
  }

  const raceNow = onOrBefore(input.training, today, (r) => r.race_5k_s !== null);
  const raceThen = onOrBefore(input.training, monthAgo, (r) => r.race_5k_s !== null);
  if (raceNow) {
    const change = (now: number | null, then: number | null | undefined) => (now !== null && then != null ? now - then : null);
    facts.race_predictions = Object.fromEntries(
      (
        [
          ["5K", raceNow.race_5k_s, raceThen?.race_5k_s],
          ["10K", raceNow.race_10k_s, raceThen?.race_10k_s],
          ["half_marathon", raceNow.race_half_s, raceThen?.race_half_s],
        ] as const
      ).flatMap(([label, now, then]) => {
        if (now === null) return [];
        const delta = change(now, then);
        return [[label, { predicted: fmtRaceTime(now), ...(delta !== null ? { seconds_faster_than_30_days_ago: -delta } : {}) }]];
      }),
    );
  }

  const cyclingVo2 = onOrBefore(input.training, today, (r) => r.vo2max_cycling !== null);
  if (cyclingVo2) facts.cycling_vo2_max = { latest: cyclingVo2.vo2max_cycling, as_of: cyclingVo2.local_date };

  const ftp = currentFtp({ activities: input.activities, training: input.training, today });
  // A worked-out estimate isn't Garmin's number; say which it is, so the summary doesn't overstate it.
  if (ftp) facts.cycling_ftp = { watts: ftp.watts, source: ftp.source === "estimate" ? "estimated from the best 20 minutes" : "set in Garmin" };

  const age = onOrBefore(input.training, today, (r) => r.fitness_age !== null);
  if (age) facts.fitness_age = { fitness_age: age.fitness_age, real_age: age.chronological_age };

  return facts;
}

export const TRAINING_SYSTEM = `You write the summary at the top of the Training tab of one person's fitness dashboard. They train mostly on a bike now (indoors on a Wahoo Kickr Core 2 and outdoors), also run, and will add swimming; heart rate comes from a chest strap. They read this to know how their training is going and what to change, not to re-read the charts.

Write exactly 4 sentences of plain prose, speaking to them as "you": no greeting, headings, lists or emoji.
1. What the last week was (the sessions across riding, running and swimming, any race or standout session) and Garmin's verdict on the load.
2. What the balance of easy and hard work over the last month says: whether the aerobic base is solid, and whether too much is landing in the middle.
3. The fitness trend in words, with at most one number (VO2 max moving, race predictions getting faster, cycling fitness still settling in).
4. One concrete thing to change or keep doing for the next few sessions, starting "The one thing to change:" when something needs changing.

Use at most two or three rounded numbers in the whole summary, and only ones in the data. Explain what a number means for them rather than listing it. Lead with riding when there is any. Garmin's load, status and load focus count every sport together. Garmin's FTP may be set wrong, so don't lean on it. Leave out anything that isn't in the data rather than guessing. This is a training log, not medical advice.

Answer as JSON with two fields:
- "summary": the 4 sentences.
- "next_sessions": the next 2 or 3 sessions, soonest first, each {"date": "YYYY-MM-DD", "title", "details", "source"}. When upcoming_planned_sessions exist, use those (source "garmin", title = Garmin's name, e.g. "Tempo"), skipping rest days. In "details", one or two plain sentences: what the workout is in words (spell out shorthand like "3x9:00@210W" as three 9-minute efforts at 210 watts with easy riding between) and how to approach it given this week's recovery and load. Garmin sets its power targets from the FTP in Garmin Connect; when best_20_min_power_watts_last_90_days is far below that FTP, say the watt targets may be too high and to ride by feel or heart rate instead. Only when nothing is planned, suggest sessions that follow from their week (source "suggested"), with a date starting tomorrow.

Example of the style (different day, different numbers; write your own from today's data):
This week mixed a hard 5K race with your first two indoor rides, and Garmin rates the result as productive. Over the past month your easy and harder aerobic work are both above Garmin's targets, so your base is solid. Running VO2 max is up 2 points in a month, a real gain, and cycling fitness will start to show after a few more logged rides. The one thing to change: slow your easy days down, because both rides and runs are drifting out of the easy zone.`;

/** Enough to write about: some riding, running or swimming in the last two weeks, or a current load. */
export function hasEnoughForTrainingSummary(facts: Record<string, unknown>): boolean {
  return "riding_last_7_days" in facts || "running_last_7_days" in facts || "swimming_last_7_days" in facts || "training_load" in facts;
}
