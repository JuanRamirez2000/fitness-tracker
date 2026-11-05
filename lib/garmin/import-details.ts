/**
 * Activity detail import: two requests per activity (samples, then the record) into
 * activity_details. Unlike the main import it writes as it goes, one activity at a time, so a
 * long backfill that Garmin rate-limits partway keeps what it fetched and the next run carries
 * on from there (only activities without a row are fetched, unless `refresh`). Three callers:
 * the main import (lib/garmin/import.ts, the window's new activities), the activity modal
 * (an activity opened before its detail was fetched), and the CLI's backfills.
 */
import type { JSONValue } from "postgres";
import type { LocalDate } from "../dates/calendar";
import { db } from "../db";
import { GarminClient, GarminError } from "./client";
import { ACTIVITY_DETAIL_COLUMNS, buildActivityDetailRow } from "./details";

/** On-foot activities get a mile-splits table; rides and swims don't. */
export const onFoot = (activityType: string) =>
  activityType.endsWith("running") || activityType.endsWith("walking") || activityType === "hiking";

export interface DetailImportOptions {
  /** Which activities: by activities.id, or every one starting in a window. */
  target: { activityIds: string[] } | { start: LocalDate; end: LocalDate };
  /** Refetch activities that already have detail. */
  refresh?: boolean;
  /** Pause between activities, to stay under Garmin's rate limit on a backfill. */
  delayMs?: number;
  log?: (line: string) => void;
  client?: GarminClient;
}

export interface DetailImportResult {
  fetched: number;
  /** Activities left without detail: Garmin rate-limited the run before it got to them. */
  remaining: number;
  /** Why the run stopped early, if it did. */
  stoppedBy?: string;
}

const UPDATES = ACTIVITY_DETAIL_COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ");
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function importActivityDetails(options: DetailImportOptions): Promise<DetailImportResult> {
  const { refresh = false, delayMs = 0, log = () => {} } = options;
  const sql = db();
  const { target } = options;
  const todo = await sql<{ id: string; user_id: string; external_id: string; activity_type: string; local_date: string }[]>`
    select a.id, a.user_id, a.external_id, a.activity_type, a.local_date
    from activities a
    left join activity_details d on d.activity_id = a.id
    where a.source = 'garmin'
      and ${"activityIds" in target ? sql`a.id = any(${target.activityIds}::uuid[])` : sql`a.local_date between ${target.start} and ${target.end}`}
      and (${refresh} or d.activity_id is null)
    order by a.started_at desc`;
  if (!todo.length) return { fetched: 0, remaining: 0 };
  log(`Fetching detail for ${todo.length} activit${todo.length === 1 ? "y" : "ies"}...`);

  const garmin = options.client ?? new GarminClient();
  let fetched = 0;
  for (const [i, activity] of todo.entries()) {
    if (i > 0 && delayMs) await pause(delayMs);
    let details, record;
    try {
      [details, record] = [await garmin.activityDetails(activity.external_id), await garmin.activityRecord(activity.external_id)];
    } catch (err) {
      if (err instanceof GarminError && err.status === 404) {
        // A manual or deleted activity has no detail: store an empty row so it isn't asked for again.
        details = record = null;
      } else if (err instanceof GarminError && err.status === 429) {
        log(`  rate-limited after ${fetched}; ${todo.length - i} left for the next run.`);
        return { fetched, remaining: todo.length - i, stoppedBy: err.message };
      } else {
        log(`  ${activity.local_date} ${activity.activity_type}: ${err instanceof Error ? err.message : String(err)}; skipped.`);
        continue;
      }
    }
    const row = buildActivityDetailRow(details, record, { withMileSplits: onFoot(activity.activity_type) });
    const json = (v: unknown) => (v === null ? null : sql.json(v as JSONValue));
    await sql`
      insert into activity_details ${sql(
        {
          ...row,
          series: json(row.series),
          mile_splits: json(row.mile_splits),
          interval_splits: json(row.interval_splits),
          activity_id: activity.id,
          user_id: activity.user_id,
        },
        "activity_id", "user_id", ...ACTIVITY_DETAIL_COLUMNS,
      )}
      on conflict (activity_id) do update set ${sql.unsafe(UPDATES)}, fetched_at = now()`;
    fetched++;
    if (todo.length > 5 && fetched % 10 === 0) log(`  ${fetched} of ${todo.length}`);
  }
  return { fetched, remaining: 0 };
}
