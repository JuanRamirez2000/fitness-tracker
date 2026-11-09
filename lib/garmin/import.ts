/**
 * Garmin import: weigh-ins, daily steps, activities, sleep and recovery (HRV, resting HR,
 * Body Battery, stress) from the Personal API, upserted into Postgres. Three callers:
 *   - Nightly: the Vercel Cron job (app/api/garmin/cron/route.ts, vercel.json) imports yesterday.
 *   - On demand: the dashboard's Refresh button (app/api/garmin/refresh/route.ts) imports today.
 *   - By hand: `npm run garmin:import` (scripts/garmin-import.ts) for backfills and dry runs.
 *
 * Idempotent: weigh_ins and activities are unique on (user_id, source, external_id), keyed by
 * Garmin's own record IDs, and daily_steps, sleep_nights and daily_recovery on
 * (user_id, local_date), so re-running a window overwrites rather than duplicates.
 *
 * Readiness, training status, race predictions and daily VO2 max are not in the Personal API;
 * scripts/garmin/import_unofficial.py imports those (docs/garmin-fields.md).
 */
import type { JSONValue } from "postgres";
import { addDays, type LocalDate } from "../dates/calendar";
import { todayIn } from "../dates/timezone";
import { db } from "../db";
import { GarminClient } from "./client";
import { importActivityDetails, type DetailImportResult } from "./import-details";
import {
  ACTIVITY_COLUMNS,
  FITNESS_AGE_COLUMNS,
  RECOVERY_COLUMNS,
  SLEEP_COLUMNS,
  WEIGH_IN_COLUMNS,
  buildActivityRows,
  buildFitnessAgeRow,
  buildRecoveryRows,
  buildSleepRows,
  buildStepsRows,
  buildWeighInRows,
  buildZoneBounds,
} from "./map";

/** "details" is each new activity's samples and splits (lib/garmin/import-details.ts), fetched
 * after the rest is written, for activities in the window that don't have them yet. */
export const DATASETS = ["weigh-ins", "steps", "activities", "sleep", "recovery", "hr-zones", "fitness-age", "details"] as const;
export type Dataset = (typeof DATASETS)[number];

export type ImportWindow =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "days"; days: number }
  | { kind: "since"; since: LocalDate };

export interface ImportOptions {
  window: ImportWindow;
  datasets?: readonly Dataset[];
  dryRun?: boolean;
  log?: (line: string) => void;
  client?: GarminClient;
  /** Pause between activities' detail requests (a backfill sets this). */
  detailDelayMs?: number;
  /** Refetch detail for activities that already have it, optionally for one sport only. */
  refreshDetails?: boolean;
  detailSport?: "ride" | "run";
}

export interface ImportResult {
  start: LocalDate;
  end: LocalDate;
  weighIns: number;
  steps: number;
  activities: number;
  sleep: number;
  recovery: number;
  fitnessAge: number;
  details: DetailImportResult | null;
}

/** The window's first and last local day, inclusive, in the athlete's own timezone. */
export function resolveWindow(window: ImportWindow, today: LocalDate): { start: LocalDate; end: LocalDate } {
  switch (window.kind) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { start: yesterday, end: yesterday };
    }
    case "days":
      return { start: addDays(today, -(Math.max(1, window.days) - 1)), end: today };
    case "since":
      return { start: window.since, end: today };
  }
}

/**
 * The window for sleep and recovery. Both land on the wake-up day, so the nightly
 * "yesterday" run also takes today: last night's sleep, HRV and wake Body Battery are
 * already final by then, and tomorrow night re-imports today's daytime values once complete.
 */
export function wellnessWindow(window: ImportWindow, today: LocalDate): { start: LocalDate; end: LocalDate } {
  const { start, end } = resolveWindow(window, today);
  return window.kind === "yesterday" ? { start, end: today } : { start, end };
}

const updates = (columns: readonly string[]) => columns.map((c) => `${c} = excluded.${c}`).join(", ");
/**
 * The Personal API's activity list has no VO2 max, so a re-import must not erase one an
 * earlier (unofficial) import stored: keep the old value when the new one is null.
 */
const ACTIVITY_UPDATES = ACTIVITY_COLUMNS.map((c) =>
  c === "vo2max" ? "vo2max = coalesce(excluded.vo2max, activities.vo2max)" : `${c} = excluded.${c}`,
).join(", ");
const SLEEP_UPDATES = updates(SLEEP_COLUMNS);
const RECOVERY_UPDATES = updates(RECOVERY_COLUMNS);
const WEIGH_IN_UPDATES = updates(WEIGH_IN_COLUMNS);
const FITNESS_AGE_UPDATES = updates(FITNESS_AGE_COLUMNS);

export async function importGarmin(options: ImportOptions): Promise<ImportResult> {
  const { datasets = DATASETS, dryRun = false, log = () => {} } = options;
  const sql = db();

  const [profile] = await sql<{ id: string; timezone: string; display_name: string | null }[]>`
    select id, timezone, display_name from profiles order by created_at limit 1`;
  if (!profile) throw new Error("No profile row in the database yet. Run `npm run db:import` first.");

  const today = todayIn(profile.timezone);
  const { start, end } = resolveWindow(options.window, today);
  const wellness = wellnessWindow(options.window, today);
  log(`Account: ${profile.display_name ?? "?"} (${profile.id})`);
  log(`Window: ${start} .. ${end} (tz ${profile.timezone})${dryRun ? " — DRY RUN, nothing will be written" : ""}`);

  const garmin = options.client ?? new GarminClient();
  const want = (d: Dataset) => datasets.includes(d);

  // Fetch everything first, so a Garmin failure partway leaves the database untouched.
  const [weighIns, steps, activities, sleep, recovery, zoneBounds, fitnessAges] = await Promise.all([
    want("weigh-ins") ? garmin.weighIns(start, end).then((r) => buildWeighInRows(r, (m) => log(`  note: ${m}`))) : [],
    want("steps") ? garmin.steps(start, end).then(buildStepsRows) : [],
    want("activities") ? garmin.activities(start, end).then(buildActivityRows) : [],
    want("sleep") ? garmin.sleep(wellness.start, wellness.end).then(buildSleepRows) : [],
    want("recovery")
      ? Promise.all([garmin.hrv(wellness.start, wellness.end), garmin.userSummaries(wellness.start, wellness.end)]).then(
          ([hrv, summaries]) => buildRecoveryRows(hrv, summaries),
        )
      : [],
    want("hr-zones")
      ? garmin.hrZones().then((z) => ({ running: buildZoneBounds(z), cycling: buildZoneBounds(z, "CYCLING") }))
      : null,
    want("fitness-age")
      ? garmin.fitnessAges(wellness.start, wellness.end).then((days) => days.flatMap(({ date, raw }) => buildFitnessAgeRow(raw, date) ?? []))
      : [],
  ]);
  log(
    `Fetched ${weighIns.length} weigh-in(s), ${steps.length} step-day(s), ${activities.length} activit${activities.length === 1 ? "y" : "ies"}, ` +
      `${sleep.length} night(s), ${recovery.length} recovery day(s), ${fitnessAges.length} fitness-age day(s)` +
      (zoneBounds?.running ? `, HR zones ${zoneBounds.running.map(([lo, hi]) => `${lo}-${hi}`).join(" / ")}` : "") +
      (zoneBounds?.cycling ? `, cycling ${zoneBounds.cycling.map(([lo, hi]) => `${lo}-${hi}`).join(" / ")}` : ""),
  );

  if (dryRun) {
    for (const [label, rows] of [
      ["weigh_ins", weighIns],
      ["daily_steps", steps],
      ["activities", activities],
      ["sleep_nights", sleep],
      ["daily_recovery", recovery],
    ] as const) {
      for (const row of rows.slice(0, 3)) log(`  ${label}: ${JSON.stringify(row)}`);
    }
  } else {
    const userId = profile.id;
    await sql.begin(async (tx) => {
      if (weighIns.length) {
        // weigh_ins_source_uidx is a PARTIAL unique index (where external_id is not null), and
        // Postgres only infers a partial index as the conflict target when the WHERE is repeated.
        await tx`
          insert into weigh_ins ${tx(
            weighIns.map((r) => ({ ...r, user_id: userId, source: "garmin" })),
            "user_id", "source", "external_id", ...WEIGH_IN_COLUMNS,
          )}
          on conflict (user_id, source, external_id) where external_id is not null
          do update set ${tx.unsafe(WEIGH_IN_UPDATES)}`;
      }
      if (steps.length) {
        await tx`
          insert into daily_steps ${tx(
            steps.map((r) => ({ ...r, user_id: userId, source: "garmin" })),
            "user_id", "local_date", "steps", "source",
          )}
          on conflict (user_id, local_date)
          do update set steps = excluded.steps, source = excluded.source, updated_at = now()`;
      }
      if (activities.length) {
        await tx`
          insert into activities ${tx(
            activities.map((r) => ({
              ...r,
              hr_zone_s: r.hr_zone_s ? tx.json(r.hr_zone_s) : null,
              power_zone_s: r.power_zone_s ? tx.json(r.power_zone_s) : null,
              power_curve: r.power_curve ? tx.json(r.power_curve) : null,
              user_id: userId,
              source: "garmin",
            })),
            "user_id", "source", "external_id", ...ACTIVITY_COLUMNS,
          )}
          on conflict (user_id, source, external_id)
          do update set ${tx.unsafe(ACTIVITY_UPDATES)}, updated_at = now()`;
      }
      if (fitnessAges.length) {
        // Only the fitness-age columns: the rest of daily_training belongs to the unofficial import.
        await tx`
          insert into daily_training ${tx(
            fitnessAges.map((r) => ({
              ...r,
              fitness_age_factors: r.fitness_age_factors ? tx.json(r.fitness_age_factors as JSONValue) : null,
              user_id: userId,
            })),
            "user_id", "local_date", ...FITNESS_AGE_COLUMNS,
          )}
          on conflict (user_id, local_date)
          do update set ${tx.unsafe(FITNESS_AGE_UPDATES)}, updated_at = now()`;
      }
      if (zoneBounds?.running) {
        await tx`update profiles set hr_zone_bounds = ${tx.json(zoneBounds.running)} where id = ${userId}`;
      }
      if (zoneBounds?.cycling) {
        await tx`update profiles set hr_zone_bounds_cycling = ${tx.json(zoneBounds.cycling)} where id = ${userId}`;
      }
      if (sleep.length) {
        await tx`
          insert into sleep_nights ${tx(
            sleep.map((r) => ({ ...r, user_id: userId })),
            "user_id", "local_date", ...SLEEP_COLUMNS,
          )}
          on conflict (user_id, local_date)
          do update set ${tx.unsafe(SLEEP_UPDATES)}, updated_at = now()`;
      }
      if (recovery.length) {
        // Only the Personal API's own columns: the readiness columns belong to the unofficial import.
        await tx`
          insert into daily_recovery ${tx(
            recovery.map((r) => ({ ...r, user_id: userId })),
            "user_id", "local_date", ...RECOVERY_COLUMNS,
          )}
          on conflict (user_id, local_date)
          do update set ${tx.unsafe(RECOVERY_UPDATES)}, updated_at = now()`;
      }
    });
    log("Upserted.");
  }

  // After the main write, so the window's new activities exist to hang detail on.
  let details: DetailImportResult | null = null;
  if (want("details") && !dryRun) {
    try {
      details = await importActivityDetails({
        target: { start, end },
        refresh: options.refreshDetails,
        sport: options.detailSport,
        delayMs: options.detailDelayMs,
        log,
        client: garmin,
      });
      if (details.fetched || details.remaining) {
        log(`Activity detail: ${details.fetched} fetched${details.remaining ? `, ${details.remaining} left (${details.stoppedBy})` : ""}.`);
      }
    } catch (err) {
      // Everything above is already written; detail is extra (a later run or the modal fills it in).
      const message = err instanceof Error ? err.message : String(err);
      log(`Activity detail failed: ${message}`);
      details = { fetched: 0, remaining: 0, stoppedBy: message };
    }
  }

  return {
    start,
    end,
    weighIns: weighIns.length,
    steps: steps.length,
    activities: activities.length,
    sleep: sleep.length,
    recovery: recovery.length,
    fitnessAge: fitnessAges.length,
    details,
  };
}
