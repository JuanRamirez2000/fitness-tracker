/**
 * Garmin import: weigh-ins, daily steps and activities from the Personal API, upserted into
 * Postgres as source='garmin' rows. Three callers:
 *   - Nightly: the Vercel Cron job (app/api/garmin/cron/route.ts, vercel.json) imports yesterday.
 *   - On demand: the dashboard's Refresh button (app/api/garmin/refresh/route.ts) imports today.
 *   - By hand: `npm run garmin:import` (scripts/garmin-import.ts) for backfills and dry runs.
 *
 * Idempotent: weigh_ins and activities are unique on (user_id, source, external_id), keyed by
 * Garmin's own record IDs, and daily_steps on (user_id, local_date), so re-running a window
 * overwrites rather than duplicates.
 */
import { addDays, type LocalDate } from "../dates/calendar";
import { todayIn } from "../dates/timezone";
import { db } from "../db";
import { GarminClient } from "./client";
import { ACTIVITY_COLUMNS, buildActivityRows, buildStepsRows, buildWeighInRows } from "./map";

export const DATASETS = ["weigh-ins", "steps", "activities"] as const;
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
}

export interface ImportResult {
  start: LocalDate;
  end: LocalDate;
  weighIns: number;
  steps: number;
  activities: number;
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

const ACTIVITY_UPDATES = ACTIVITY_COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ");

export async function importGarmin(options: ImportOptions): Promise<ImportResult> {
  const { datasets = DATASETS, dryRun = false, log = () => {} } = options;
  const sql = db();

  const [profile] = await sql<{ id: string; timezone: string; display_name: string | null }[]>`
    select id, timezone, display_name from profiles order by created_at limit 1`;
  if (!profile) throw new Error("No profile row in the database yet. Run `npm run db:import` first.");

  const { start, end } = resolveWindow(options.window, todayIn(profile.timezone));
  log(`Account: ${profile.display_name ?? "?"} (${profile.id})`);
  log(`Window: ${start} .. ${end} (tz ${profile.timezone})${dryRun ? " — DRY RUN, nothing will be written" : ""}`);

  const garmin = options.client ?? new GarminClient();
  const want = (d: Dataset) => datasets.includes(d);

  // Fetch everything first, so a Garmin failure partway leaves the database untouched.
  const [weighIns, steps, activities] = await Promise.all([
    want("weigh-ins") ? garmin.weighIns(start, end).then((r) => buildWeighInRows(r, (m) => log(`  note: ${m}`))) : [],
    want("steps") ? garmin.steps(start, end).then(buildStepsRows) : [],
    want("activities") ? garmin.activities(start, end).then(buildActivityRows) : [],
  ]);
  log(`Fetched ${weighIns.length} weigh-in(s), ${steps.length} step-day(s), ${activities.length} activit${activities.length === 1 ? "y" : "ies"}`);

  if (dryRun) {
    for (const [label, rows] of [["weigh_ins", weighIns], ["daily_steps", steps], ["activities", activities]] as const) {
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
            "user_id", "measured_at", "local_date", "weight_lb", "source", "external_id",
          )}
          on conflict (user_id, source, external_id) where external_id is not null
          do update set measured_at = excluded.measured_at, local_date = excluded.local_date,
                        weight_lb = excluded.weight_lb`;
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
            activities.map((r) => ({ ...r, user_id: userId, source: "garmin" })),
            "user_id", "source", "external_id", ...ACTIVITY_COLUMNS,
          )}
          on conflict (user_id, source, external_id)
          do update set ${tx.unsafe(ACTIVITY_UPDATES)}, updated_at = now()`;
      }
    });
    log("Upserted.");
  }

  return { start, end, weighIns: weighIns.length, steps: steps.length, activities: activities.length };
}
