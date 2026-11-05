/**
 * One activity's detail → an activity_details row: the samples from
 * /activity-service/activity/{id}/details thinned for charting, per-mile splits worked out from
 * the full-resolution samples, and the feel, RPE, location and split summaries from
 * /activity-service/activity/{id}. Pure, unit-tested (details.test.ts).
 */
import type { ActivitySeries, IntervalSplit, MileSplit, SeriesKey } from "../data/activity-details";

export const METERS_PER_MILE = 1609.344;
/** Enough points for a chart a card wide, small enough to send with the modal (~30 KB). */
export const SERIES_POINTS = 400;
/** A last partial mile shorter than this is folded out of the splits table. */
const MIN_PARTIAL_MILE_M = 0.1 * METERS_PER_MILE;

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
}

/** The activity_details columns the import writes besides activity_id and user_id. */
export const ACTIVITY_DETAIL_COLUMNS = [
  "location_name", "workout_feel", "workout_rpe", "min_hr", "stamina_start", "stamina_end", "series",
  "mile_splits", "interval_splits",
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

/** Per-mile splits from full-resolution samples; null without distance. */
export function mileSplits(samples: Samples): MileSplit[] | null {
  const d = samples.cols.d;
  if (!d) return null;
  const { t } = samples;
  const splits: MileSplit[] = [];
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
    for (let i = 1; i < elev.length; i++) {
      const step = elev[i] - elev[i - 1];
      if (step > 0) gain += step;
      else loss -= step;
    }
    const hr = mean(samples.cols.hr);
    const cadence = mean(samples.cols.cadence);
    const gap = mean(samples.cols.gap);
    splits.push({
      mile: splits.length + 1,
      distance_m: round(endD - startD, 1),
      duration_s: round(endT - startT, 1),
      avg_hr: hr === null ? null : Math.round(hr),
      avg_cadence_spm: cadence === null ? null : Math.round(cadence),
      avg_gap_mps: gap === null ? null : round(gap, 3),
      elevation_gain_m: round(gain, 1),
      elevation_loss_m: round(loss, 1),
    });
  };

  let prevT = 0;
  let prevD = 0;
  for (let i = 0; i < t.length; i++) {
    const di = d[i];
    if (!finite(di)) continue;
    // A boundary (or several, after a GPS jump) between the previous sample and this one:
    // interpolate the time it was crossed.
    while (di >= startD + METERS_PER_MILE) {
      const boundary = startD + METERS_PER_MILE;
      const frac = di === prevD ? 1 : (boundary - prevD) / (di - prevD);
      const crossT = prevT + frac * (t[i] - prevT);
      close(i, crossT, boundary);
      startT = crossT;
      startD = boundary;
      from = i;
    }
    prevT = t[i];
    prevD = di;
  }
  if (prevD - startD >= MIN_PARTIAL_MILE_M) close(t.length, prevT, prevD);
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
            elevation_gain_m: finite(s.elevationGain) ? round(s.elevationGain, 1) : null,
          },
        ]
      : [],
  );
  return rows.length ? rows : null;
}

/**
 * The row for one activity. `withMileSplits` is for on-foot activities: a mile table means
 * little for a ride or a pool swim.
 */
export function buildActivityDetailRow(
  details: RawActivityDetails | null,
  record: RawActivityRecord | null,
  { withMileSplits }: { withMileSplits: boolean },
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
  };
}
