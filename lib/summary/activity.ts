import type { ActivityView } from "@/lib/activity/view";
import { fmtPace } from "@/lib/running/runs";

/** Longer activities list a summary of their miles rather than every one. */
const MAX_SPLITS = 26;

const withUnit = (value: string, unit?: string) => (unit ? `${value} ${unit}` : value);

/**
 * One activity's facts for its summary, from the same view the modal draws (lib/activity/view.ts),
 * so the text can only cite numbers the reader can see beside it. Only what exists. Pure,
 * unit-tested.
 */
export function activityFacts(view: ActivityView): Record<string, unknown> {
  const facts: Record<string, unknown> = {
    activity: {
      type: view.typeLabel,
      name: view.name,
      date: view.date,
      start_time: view.startClock,
      ...(view.kind ? { kind: view.kind === "easy" ? (view.isRide ? "easy ride" : "easy run") : "workout" } : {}),
      ...(view.indoor ? { indoor: "on a trainer: speed and distance are the trainer's estimate, so judge it by power and heart rate" } : {}),
      ...(view.benefit ? { garmin_primary_benefit: view.benefit } : {}),
    },
    // Every stat the modal lists, labelled as it shows them ("Avg pace": "11:34 /mi").
    stats: Object.fromEntries(
      [...view.headline, ...view.groups.flatMap((g) => g.stats)].map((s) => [s.label, s.note ? `${withUnit(s.value, s.unit)} (${s.note})` : withUnit(s.value, s.unit)]),
    ),
  };

  if (view.splits.length) {
    const rows = view.splits.map((s) => ({
      mile: s.label,
      pace_per_mile: fmtPace(s.pace_s),
      ...(s.gapPace_s !== null ? { grade_adjusted_pace: fmtPace(s.gapPace_s) } : {}),
      ...(s.hr !== null ? { avg_hr: s.hr } : {}),
      ...(s.elevGainFt || s.elevLossFt ? { climb_ft: s.elevGainFt, descent_ft: s.elevLossFt } : {}),
    }));
    if (rows.length <= MAX_SPLITS) facts.mile_splits = rows;
    else {
      const paces = view.splits.map((s) => s.pace_s);
      facts.mile_splits_summary = {
        miles: rows.length,
        fastest: fmtPace(Math.min(...paces)),
        slowest: fmtPace(Math.max(...paces)),
        first: rows[0],
        last: rows[rows.length - 1],
      };
    }
  }
  if (view.rideSplits.length) {
    facts.ride_splits = view.rideSplits.map((s) => ({
      split: s.label,
      time: s.duration,
      ...(s.mph !== null && !view.indoor ? { mph: s.mph } : {}),
      ...(s.power !== null ? { avg_power_watts: s.power } : {}),
      ...(s.hr !== null ? { avg_hr: s.hr } : {}),
      ...(s.cadence !== null ? { cadence_rpm: s.cadence } : {}),
      ...(s.elevGainFt ? { climb_ft: s.elevGainFt } : {}),
    }));
  }
  if (view.intervals.length) {
    facts.segments = view.intervals.map((i) => ({
      segment: i.label,
      count: i.count,
      ...(i.miles !== null ? { miles: Math.round(i.miles * 100) / 100 } : {}),
      ...(i.duration ? { time: i.duration } : {}),
      ...(i.speed ? { [view.isRun ? "pace" : "speed"]: i.speed } : {}),
      ...(i.power !== null ? { avg_power_watts: i.power } : {}),
      ...(i.hr !== null ? { avg_hr: i.hr } : {}),
    }));
  }
  if (view.zones) {
    facts.time_in_hr_zones_percent = Object.fromEntries(view.zones.map((z) => [`Z${z.zone}${z.low !== null ? ` (${z.low}-${z.high} bpm)` : ""}`, Math.round(z.share * 100)]));
  }

  const c = view.context;
  if (c.similar?.sport === "ride") {
    const s = c.similar;
    facts.vs_similar_recent_rides = {
      compared_with: `${s.count} earlier ${s.kind ? `${s.kind === "easy" ? "easy" : "hard"} ` : ""}${view.indoor ? "indoor " : ""}rides of about this length in the last 4 months`,
      rank: `${s.paceRank} of ${s.count + 1} (1 = ${s.powerDelta_w !== null ? "most average power" : "fastest"})`,
      ...(s.powerDelta_w !== null ? { avg_power_watts_vs_their_median: s.powerDelta_w } : {}),
      ...(s.speedDelta_mph !== null ? { mph_vs_their_median: s.speedDelta_mph } : {}),
      ...(s.hrDelta !== null ? { avg_hr_bpm_vs_their_median: s.hrDelta } : {}),
      ...(s.efficiencyPct !== null ? { watts_per_heartbeat_percent_vs_their_median: s.efficiencyPct } : {}),
    };
  } else if (c.similar) {
    facts.vs_similar_recent_runs = {
      compared_with: `${c.similar.count} earlier ${c.similar.kind ? `${c.similar.kind} ` : ""}runs of about this distance in the last 4 months`,
      pace_rank: `${c.similar.paceRank} of ${c.similar.count + 1} (1 = fastest)`,
      pace_seconds_per_mile_vs_their_median: c.similar.paceDelta_s,
      ...(c.similar.hrDelta !== null ? { avg_hr_bpm_vs_their_median: c.similar.hrDelta } : {}),
      ...(c.similar.efficiencyPct !== null ? { speed_per_heartbeat_percent_vs_their_median: c.similar.efficiencyPct } : {}),
    };
  }
  if (c.load?.avg28 != null) facts.training_load_vs_4_week_average_per_activity = { this: c.load.value, average: c.load.avg28 };
  if (view.isRun) facts.running_that_week = { miles_in_7_days_to_this_run: c.week.miles, runs: c.week.count, miles_the_week_before: c.week.milesPrior };
  if (view.isRide) facts.riding_that_week = { rides_in_7_days_to_this_one: c.week.count, hours: c.week.hours, miles: c.week.miles };
  if (c.goingIn) {
    facts.load_going_in = {
      acute: Math.round(c.goingIn.acute),
      ...(c.goingIn.chronic !== null ? { chronic: Math.round(c.goingIn.chronic) } : {}),
      ...(c.goingIn.ratio !== null ? { acute_chronic_ratio: c.goingIn.ratio, healthy_ratio_range: [0.8, 1.5] } : {}),
      ...(c.goingIn.status ? { garmin_training_status: c.goingIn.status } : {}),
    };
  }
  const m = c.morning;
  if (m) {
    const morning = {
      ...(m.readiness !== null ? { training_readiness_0_100: m.readiness, readiness_level: m.readinessLevel } : {}),
      ...(m.sleepHours !== null ? { sleep_hours: m.sleepHours } : {}),
      ...(m.sleepNeedHours !== null ? { sleep_need_hours: m.sleepNeedHours } : {}),
      ...(m.sleepScore !== null ? { sleep_score: m.sleepScore } : {}),
      ...(m.hrv !== null ? { overnight_hrv_ms: m.hrv } : {}),
      ...(m.hrvRange ? { hrv_normal_range_ms: m.hrvRange } : {}),
      ...(m.restingHr !== null ? { resting_hr: m.restingHr } : {}),
      ...(m.bodyBatteryWake !== null ? { body_battery_at_wake: m.bodyBatteryWake } : {}),
    };
    if (Object.keys(morning).length) facts.that_morning = morning;
  }
  return facts;
}

export const ACTIVITY_SYSTEM = `You write the short summary at the top of one activity in a person's fitness log. They train mostly on a bike now (indoors on a Wahoo Kickr Core 2 and outdoors), also run (many runs alternate running and walking), and will add swimming; heart rate comes from a chest strap.

Write exactly 4 sentences of plain prose, speaking to them as "you": no greeting, headings, lists or emoji.
1. What kind of session it was and how it went, with its two or three most telling numbers (a ride's time and power, a run's distance and time, where the heart rate sat).
2. Where it sat in their week and recovery: what came before it (a race, a hard day, a short night) and whether the effort fit.
3. One detail that stands out (pacing across the splits, cadence, heart rate drift, what it cost in Body Battery) and what it means.
4. One tip for next time a session like this comes up.

Round as a person would; write run paces as a clock ("11:20 per mile") and ride speeds in mph. An intensity factor and TSS are against the FTP set in Garmin, which may be out of date, so don't lean on them. Use only the numbers in the data; leave out anything that isn't there rather than guessing. This is a training log, not medical advice: don't diagnose or suggest treatment.

Example of the style (a different session; write your own from this activity's data):
This was a true recovery spin: 23 minutes at about 100 watts, with your heart rate in zone 2 the whole way. It came two days after your 5K race and a day after a harder ride, so keeping it this light was the right call. It cost only 2 points of Body Battery, but your cadence sat around 72 rpm, a little low for loosening the legs. Next recovery day, try an easier gear at 85 to 90 rpm, which flushes the legs with less strain.`;

export function activityUserMessage(facts: Record<string, unknown>): string {
  return `The activity:\n${JSON.stringify(facts, null, 2)}`;
}
