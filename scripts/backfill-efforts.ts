/**
 * Works out best efforts (lib/garmin/efforts.ts) for on-foot activities whose detail was fetched
 * before migration 012. New activities get theirs at import, from the full-resolution samples.
 * Only rows without efforts are touched, so re-running never undoes a full-resolution result (a
 * refetched long run still stores a coarse series, but its efforts came from the full samples).
 *
 * From the stored series where it's fine enough: one point every MAX_SPACING_S or closer. A long
 * activity's stored series is coarser (400 points over hours), and a walk break shorter than a
 * point averages away, so those are left out here and `--refetch-coarse` fetches their detail
 * from Garmin again (two requests each) and works the efforts out from full resolution.
 *
 *   npm run efforts:backfill                         # DATABASE_URL from .env.local's LAST line (often localhost!)
 *   DATABASE_URL='<neon url>' npm run efforts:backfill -- --refetch-coarse
 */
import { parseArgs } from "node:util";
import type { JSONValue } from "postgres";
import { activitySeriesSchema } from "../lib/data/activity-details";
import { onFoot } from "../lib/data/activities";
import { db } from "../lib/db";
import { bestEfforts } from "../lib/garmin/efforts";
import { importActivityDetails } from "../lib/garmin/import-details";

/** Coarser than this (seconds between stored points) and a walk break can vanish into one point. */
export const MAX_SPACING_S = 8;

async function main() {
  const { values } = parseArgs({ options: { "refetch-coarse": { type: "boolean", default: false } } });
  const sql = db();
  console.log(`Database: ${new URL(process.env.DATABASE_URL!).hostname}`);
  const rows = await sql<{ activity_id: string; activity_type: string; series: unknown }[]>`
    select d.activity_id, a.activity_type, d.series
    from activity_details d join activities a on a.id = d.activity_id
    where d.series is not null and d.efforts is null`;

  const coarse: string[] = [];
  let written = 0;
  for (const row of rows) {
    if (!onFoot(row.activity_type)) continue;
    const series = activitySeriesSchema.parse(row.series);
    const spacing = series.t.length > 1 ? (series.t[series.t.length - 1] - series.t[0]) / (series.t.length - 1) : 0;
    if (spacing > MAX_SPACING_S) {
      coarse.push(row.activity_id);
      continue;
    }
    const efforts = bestEfforts(series.t, series.d, series.cadence);
    await sql`update activity_details set efforts = ${sql.json(efforts as JSONValue)} where activity_id = ${row.activity_id}`;
    written++;
  }
  console.log(`Efforts written from stored series for ${written} activities; ${coarse.length} have too coarse a series.`);

  if (coarse.length && values["refetch-coarse"]) {
    const result = await importActivityDetails({ target: { activityIds: coarse }, refresh: true, delayMs: 1500, log: console.log });
    console.log(`Refetched ${result.fetched} from Garmin${result.remaining ? `; ${result.remaining} left (${result.stoppedBy})` : ""}.`);
    if (result.remaining) process.exitCode = 1;
  } else if (coarse.length) {
    console.log("Run again with --refetch-coarse to fetch those from Garmin.");
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
