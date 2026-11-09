/**
 * One activity's detail → an activity_details row: the samples from
 * /activity-service/activity/{id}/details thinned for charting, per-mile splits worked out from
 * the full-resolution samples, and the feel, RPE, location and split summaries from
 * /activity-service/activity/{id}. Pure, unit-tested (details.test.ts).
 */
import type { ActivityEfforts, ActivitySeries, IntervalSplit, MileSplit, RideSplit, SeriesKey } from "../data/activity-details";
import { bestEfforts } from "./efforts";

export const METERS_PER_MILE = 1609.344;
/** Enough points for a chart a card wide, small enough to send with the modal (~30 KB). */
export const SERIES_POINTS = 400;
/**
 * Elevation changes smaller than this (meters) are watch noise: counting every wobble between
 * samples overstates a flat mile's climb several times over, so climb and descent only count
 * once the elevation has moved this far from the last counted point.
 */
const ELEVATION_STEP_M = 2;
/** A last partial mile shorter than this is folded out of the splits table. */
const MIN_PARTIAL_MILE_M = 0.1 * METERS_PER_MILE;
/** Rides split every 5 miles outdoors, every 5 minutes indoors; a last split under a quarter of that is folded out. */
export const RIDE_SPLIT_M = 5 * METERS_PER_MILE;
export const RIDE_SPLIT_S = 5 * 60;
const MIN_PARTIAL_SHARE = 0.25;

export interface RawActivityDetails {
  metricDescriptors?: { metricsIndex: number; key: string }[] | null;
  activityDetailMetrics?: { metrics?: (number | null)[] | null }[] | null;
}

interface RawSplitSummary {
  splitType?: string | null;
  noOfSplits?: number | null;
  distance?: number | null;
  duration?: number | null;
  averageSpeed?: number | null;
  averageHR?: number | null;
  maxHR?: number | null;
  averageRunCadence?: number | null;
  averageBikeCadence?: number | null;
  averagePower?: number | null;
  elevationGain?: number | null;
}

export interface RawActivityRecord {
  locationName?: string | null;
  summaryDTO?: {
    directWorkoutFeel?: number | null;
    directWorkoutRpe?: number | null;
    minHR?: number | null;
    beginPotentialStamina?: number | null;
    endPotentialStamina?: number | null;
  } | null;
  splitSummaries?: RawSplitSummary[] | null;
}

export interface ActivityDetailRow {
  location_name: string | null;
  workout_feel: number | null;
  workout_rpe: number | null;
  min_hr: number | null;
  stamina_start: number | null;
  stamina_end: number | null;
  series: ActivitySeries | null;
  mile_splits: MileSplit[] | null;
  interval_splits: IntervalSplit[] | null;
  /** On-foot activities only: best times over set distances and the longest continuous running. */
  efforts: ActivityEfforts | null;
  /** Rides only: 5-mile (outdoors) or 5-minute (indoors) splits. */
  ride_splits: RideSplit[] | null;
}

/** The activity_details columns the import writes besides activity_id and user_id. */
export const ACTIVITY_DETAIL_COLUMNS = [
  "location_name", "workout_feel", "workout_rpe", "min_hr", "stamina_start", "stamina_end", "series",
  "mile_splits", "interval_splits", "efforts", "ride_splits",
] as const satisfies readonly (keyof ActivityDetailRow)[];

/** Garmin's metric key for each series, first match wins, and the decimals kept. */
const METRICS: Record<SeriesKey, { keys: string[]; decimals: number }> = {
  d: { keys: ["sumDistance"], decimals: 1 },
  hr: { keys: ["directHeartRate"], decimals: 0 },
  speed: { keys: ["directSpeed"], decimals: 3 },
  gap: { keys: ["directGradeAdjustedSpeed"], decimals: 3 },
  // Double cadence is both feet (what Garmin's running averages report); rides have bike cadence.
  cadence: { keys: ["directDoubleCadence", "directBikeCadence"], decimals: 0 },
  elev: { keys: ["directElevation"], decimals: 1 },
  power: { keys: ["directPower"], decimals: 0 },
  stride: { keys: ["directStrideLength"], decimals: 1 },
  gct: { keys: ["directGroundContactTime"], decimals: 0 },
  vo: { keys: ["directVerticalOscillation"], decimals: 1 },
  bb: { keys: ["directBodyBattery"], decimals: 0 },
  stamina: { keys: ["directAvailableStamina"], decimals: 0 },
  perf: { keys: ["directPerformanceCondition"], decimals: 0 },
  temp: { keys: ["directAirTemperature"], decimals: 0 },
  lat: { keys: ["directLatitude"], decimals: 6 },
  lon: { keys: ["directLongitude"], decimals: 6 },
};
/** Positions: the bucket's last value. Everything else: the bucket's mean. */
const LAST_IN_BUCKET = new Set<SeriesKey>(["d", "lat", "lon"]);

const round = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};
const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const intOrNull = (v: number | null | undefined) => (finite(v) ? Math.round(v) : null);

/** Full-resolution samples: t (timer seconds) plus every metric present, as parallel arrays. */
interface Samples {
  t: number[];
  cols: Partial<Record<SeriesKey, (number | null)[]>>;
}

export function readSamples(raw: RawActivityDetails): Samples | null {
  const descriptors = raw.metricDescriptors ?? [];
  const rows = (raw.activityDetailMetrics ?? []).map((r) => r.metrics ?? []);
  if (!rows.length) return null;
  const index = (key: string) => descriptors.find((d) => d.key === key)?.metricsIndex;

  const timerIdx = index("sumDuration");
  const stampIdx = index("directTimestamp");
  const firstStamp = stampIdx !== undefined ? rows.find((r) => finite(r[stampIdx]))?.[stampIdx] : undefined;
  const t: number[] = [];
  const keep: number[] = [];
  rows.forEach((r, i) => {
    const timer = timerIdx !== undefined ? r[timerIdx] : null;
    const stamp = stampIdx !== undefined ? r[stampIdx] : null;
    const sec = finite(timer) ? timer : finite(stamp) && finite(firstStamp) ? (stamp - firstStamp) / 1000 : null;
    if (sec === null) return;
    t.push(sec);
    keep.push(i);
  });
  if (!t.length) return null;

  const cols: Samples["cols"] = {};
  for (const [name, spec] of Object.entries(METRICS) as [SeriesKey, (typeof METRICS)[SeriesKey]][]) {
    const idx = spec.keys.map(index).find((i) => i !== undefined);
    if (idx === undefined) continue;
    const values = keep.map((i) => (finite(rows[i][idx]) ? (rows[i][idx] as number) : null));
    if (values.some((v) => v !== null)) cols[name] = values;
  }
  return { t, cols };
}

/** At most `points` evenly sized buckets of consecutive samples. */
export function thinSeries(samples: Samples, points = SERIES_POINTS): ActivitySeries {
  const n = samples.t.length;
  const size = Math.max(1, Math.ceil(n / points));
  const series: ActivitySeries = { t: [] };
  const buckets: [number, number][] = [];
  for (let start = 0; start < n; start += size) buckets.push([start, Math.min(n, start + size)]);

  series.t = buckets.map(([, end]) => round(samples.t[end - 1], 0));
  for (const [name, values] of Object.entries(samples.cols) as [SeriesKey, (number | null)[]][]) {
    const { decimals } = METRICS[name];
    series[name] = buckets.map(([start, end]) => {
      const inBucket = values.slice(start, end).filter(finite);
      if (!inBucket.length) return null;
      const v = LAST_IN_BUCKET.has(name) ? inBucket[inBucket.length - 1] : inBucket.reduce((a, b) => a + b, 0) / inBucket.length;
      return round(v, decimals);
    });
  }
  return series;
}

/** One stretch between split boundaries, before it's shaped into a mile or ride split. */
interface Stretch {
  distance_m: number;
  duration_s: number;
  hr: number | null;
  cadence: number | null;
  gap: number | null;
  power: number | null;
  gain: number;
  loss: number;
}

/**
 * Cuts the samples every `size` along `axis` (cumulative distance or timer time), interpolating
 * the moment each boundary was crossed. A last stretch shorter than `minPartial` is dropped.
 */
function splitAlong(samples: Samples, axis: (number | null)[], size: number, minPartial: number): Stretch[] {
  const { t } = samples;
  const d = samples.cols.d;
  const stretches: Stretch[] = [];
  let startA = 0;
  let startT = 0;
  let startD = 0;
  let from = 0;

  const close = (to: number, endT: number, endD: number) => {
    const mean = (col: (number | null)[] | undefined) => {
      const v = (col ?? []).slice(from, to).filter(finite);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    let gain = 0;
    let loss = 0;
    const elev = (samples.cols.elev ?? []).slice(from, to).filter(finite);
    let ref = elev[0];
    for (const e of elev) {
      if (e - ref >= ELEVATION_STEP_M) {
        gain += e - ref;
        ref = e;
      } else if (ref - e >= ELEVATION_STEP_M) {
        loss += ref - e;
        ref = e;
      }
    }
    stretches.push({
      distance_m: round(endD - startD, 1),
      duration_s: round(endT - startT, 1),
      hr: mean(samples.cols.hr),
      cadence: mean(samples.cols.cadence),
      gap: mean(samples.cols.gap),
      power: mean(samples.cols.power),
      gain: round(gain, 1),
      loss: round(loss, 1),
    });
  };

  // Distance at sample i, carried forward over gaps (time-cut rides may miss a few distance samples).
  let lastD = 0;
  const distAt = (i: number) => {
    const v = d?.[i];
    if (finite(v)) lastD = v;
    return lastD;
  };

  let prevA = 0;
  let prevT = 0;
  let prevD = 0;
  for (let i = 0; i < t.length; i++) {
    const ai = axis[i];
    const di = distAt(i);
    if (!finite(ai)) continue;
    // A boundary (or several, after a GPS jump) between the previous sample and this one:
    // interpolate when it was crossed.
    while (ai >= startA + size) {
      const boundary = startA + size;
      const frac = ai === prevA ? 1 : (boundary - prevA) / (ai - prevA);
      const crossT = prevT + frac * (t[i] - prevT);
      const crossD = prevD + frac * (di - prevD);
      close(i, crossT, crossD);
      startA = boundary;
      startT = crossT;
      startD = crossD;
      from = i;
    }
    prevA = ai;
    prevT = t[i];
    prevD = di;
  }
  if (prevA - startA >= minPartial) close(t.length, prevT, prevD);
  return stretches;
}

const intRound = (v: number | null) => (v === null ? null : Math.round(v));

/** Per-mile splits from full-resolution samples; null without distance. */
export function mileSplits(samples: Samples): MileSplit[] | null {
  const d = samples.cols.d;
  if (!d) return null;
  const splits = splitAlong(samples, d, METERS_PER_MILE, MIN_PARTIAL_MILE_M).map((s, i) => ({
    mile: i + 1,
    distance_m: s.distance_m,
    duration_s: s.duration_s,
    avg_hr: intRound(s.hr),
    avg_cadence_spm: intRound(s.cadence),
    avg_gap_mps: s.gap === null ? null : round(s.gap, 3),
    elevation_gain_m: s.gain,
    elevation_loss_m: s.loss,
  }));
  return splits.length ? splits : null;
}

/**
 * A ride's splits: every 5 miles outdoors, or every 5 minutes indoors, where the distance is
 * only the trainer's estimate. Null when an outdoor ride has no distance.
 */
export function rideSplits(samples: Samples, { indoor }: { indoor: boolean }): RideSplit[] | null {
  const by: RideSplit["by"] = indoor || !samples.cols.d ? "time" : "distance";
  const axis = by === "time" ? samples.t : samples.cols.d!;
  const size = by === "time" ? RIDE_SPLIT_S : RIDE_SPLIT_M;
  const splits = splitAlong(samples, axis, size, size * MIN_PARTIAL_SHARE).map((s, i) => ({
    split: i + 1,
    by,
    distance_m: s.distance_m,
    duration_s: s.duration_s,
    avg_hr: intRound(s.hr),
    avg_power_w: intRound(s.power),
    avg_cadence_rpm: intRound(s.cadence),
    elevation_gain_m: s.gain,
    elevation_loss_m: s.loss,
  }));
  return splits.length ? splits : null;
}

function intervalSplits(record: RawActivityRecord): IntervalSplit[] | null {
  const rows = (record.splitSummaries ?? []).flatMap((s) =>
    s.splitType && (s.noOfSplits ?? 0) > 0
      ? [
          {
            type: s.splitType,
            count: s.noOfSplits as number,
            distance_m: finite(s.distance) ? round(s.distance, 1) : null,
            duration_s: finite(s.duration) ? round(s.duration, 1) : null,
            avg_speed_mps: finite(s.averageSpeed) ? round(s.averageSpeed, 3) : null,
            avg_hr: intOrNull(s.averageHR),
            max_hr: intOrNull(s.maxHR),
            avg_cadence_spm: intOrNull(s.averageRunCadence),
            avg_cadence_rpm: intOrNull(s.averageBikeCadence),
            avg_power_w: intOrNull(s.averagePower),
            elevation_gain_m: finite(s.elevationGain) ? round(s.elevationGain, 1) : null,
          },
        ]
      : [],
  );
  return rows.length ? rows : null;
}

/**
 * The row for one activity. `withMileSplits` is for on-foot activities: a mile table means
 * little for a ride or a pool swim. `ride` gets the ride's own splits instead (`indoor`: cut by
 * time, since a trainer's distance is a guess).
 */
export function buildActivityDetailRow(
  details: RawActivityDetails | null,
  record: RawActivityRecord | null,
  { withMileSplits, ride = null }: { withMileSplits: boolean; ride?: { indoor: boolean } | null },
): ActivityDetailRow {
  const samples = details ? readSamples(details) : null;
  const s = record?.summaryDTO ?? {};
  return {
    location_name: record?.locationName ?? null,
    workout_feel: intOrNull(s.directWorkoutFeel),
    workout_rpe: intOrNull(s.directWorkoutRpe),
    min_hr: intOrNull(s.minHR),
    stamina_start: intOrNull(s.beginPotentialStamina),
    stamina_end: intOrNull(s.endPotentialStamina),
    series: samples ? thinSeries(samples) : null,
    mile_splits: samples && withMileSplits ? mileSplits(samples) : null,
    interval_splits: record ? intervalSplits(record) : null,
    // From the full-resolution samples, before thinning.
    efforts: samples && withMileSplits ? bestEfforts(samples.t, samples.cols.d, samples.cols.cadence) : null,
    ride_splits: samples && ride ? rideSplits(samples, ride) : null,
  };
}
