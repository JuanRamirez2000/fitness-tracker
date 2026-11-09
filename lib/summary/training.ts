import type { Activity } from "@/lib/data/activities";
import type { Profile } from "@/lib/data/profiles";
import type { DailyTraining } from "@/lib/data/training";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { buildLoadFocus, buildZoneChart, trainingStatus } from "@/lib/charts/training";
import { fmtRaceTime } from "@/lib/charts/fitness";
import { currentFtp } from "@/lib/kpis/ftp";
import { runMiles, runsIn, runsOf } from "@/lib/running/runs";
import { isRide } from "@/lib/sport";

/** The rows the Training tab's summary is written from. */
export interface TrainingSummaryInput {
  today: LocalDate;
  profile: Pick<Profile, "hr_zone_bounds" | "hr_zone_bounds_cycling">;
  /** Activities from at least the last 14 days, oldest first. */
  activities: Activity[];
  /** Daily training snapshots from at least the last 30 days, oldest first. */
  training: DailyTraining[];
}

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

export const TRAINING_SYSTEM = `You write the summary at the top of the Training tab of one person's fitness dashboard (they used to train mostly by running and are now mostly riding a bike, indoors and out, with some running). The tab answers two questions: am I training at the right effort and load, and am I getting fitter and faster?

Write 2 to 3 sentences of plain prose: no greeting, headings, lists or emoji. Cover the effort and load of the last week first (riding and running volume, how much was easy against the 80% aim, load and its ratio, Garmin's status), then the fitness trend (cycling FTP and VO2 max, running VO2 max and race predictions, fitness age), picking what's most notable rather than listing everything. Lead with riding when there is any. Garmin's load and status count rides and runs together.

Use only the numbers in the data; leave out anything that isn't there rather than guessing. Round as a person would, write race times as a clock ("29:13") and ride speeds in mph. This is a training log, not medical advice.`;

/** Enough to write about: some riding or running in the last two weeks, or a current load. */
export function hasEnoughForTrainingSummary(facts: Record<string, unknown>): boolean {
  return "riding_last_7_days" in facts || "running_last_7_days" in facts || "training_load" in facts;
}
