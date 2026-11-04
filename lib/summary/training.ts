import type { Activity } from "@/lib/data/activities";
import type { Profile } from "@/lib/data/profiles";
import type { DailyTraining } from "@/lib/data/training";
import { addDays, type LocalDate } from "@/lib/dates/calendar";
import { buildLoadFocus, buildZoneChart, trainingStatus } from "@/lib/charts/training";
import { fmtRaceTime } from "@/lib/charts/fitness";
import { runMiles, runsIn, runsOf } from "@/lib/running/runs";

/** The rows the Training tab's summary is written from. */
export interface TrainingSummaryInput {
  today: LocalDate;
  profile: Pick<Profile, "hr_zone_bounds">;
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

  const runs = runsOf(input.activities);
  const last7 = runsIn(runs, { from: addDays(today, -6), to: today });
  const prior7 = runsIn(runs, { from: addDays(today, -13), to: addDays(today, -7) });
  if (last7.length || prior7.length) {
    const zones = buildZoneChart({
      activities: input.activities,
      dateRange: { key: "week", from: addDays(today, -6), to: today },
      today,
      profile: input.profile,
    });
    facts.running_last_7_days = {
      runs: last7.length,
      miles: round1(last7.reduce((sum, r) => sum + runMiles(r), 0)),
      miles_the_week_before: round1(prior7.reduce((sum, r) => sum + runMiles(r), 0)),
      ...(zones && zones.totalMinutes > 0
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

  const age = onOrBefore(input.training, today, (r) => r.fitness_age !== null);
  if (age) facts.fitness_age = { fitness_age: age.fitness_age, real_age: age.chronological_age };

  return facts;
}

export const TRAINING_SYSTEM = `You write the summary at the top of the Training tab of one person's fitness dashboard (they are a runner). The tab answers two questions: am I training at the right effort and load, and am I getting fitter and faster?

Write 2 to 3 sentences of plain prose: no greeting, headings, lists or emoji. Cover the effort and load of the last week first (volume, how much was easy against the 80% aim, load and its ratio, Garmin's status), then the fitness trend (VO2 max, race predictions, fitness age), picking what's most notable rather than listing everything.

Use only the numbers in the data; leave out anything that isn't there rather than guessing. Round as a person would and write race times as a clock ("29:13"). This is a training log, not medical advice.`;

/** Enough to write about: some running in the last two weeks, or a current load. */
export function hasEnoughForTrainingSummary(facts: Record<string, unknown>): boolean {
  return "running_last_7_days" in facts || "training_load" in facts;
}
