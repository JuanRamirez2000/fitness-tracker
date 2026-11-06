/**
 * Works out best efforts (lib/garmin/efforts.ts) for on-foot activities whose detail was fetched
 * before migration 012, from their stored, thinned series. New activities get theirs at import,
 * from the full-resolution samples. Safe to re-run: only rows without efforts are touched.
 *
 *   npm run efforts:backfill              # DATABASE_URL from .env.local's LAST line (often localhost!)
 *   DATABASE_URL='<neon url>' npm run efforts:backfill
 */
import type { JSONValue } from "postgres";
import { activitySeriesSchema } from "../lib/data/activity-details";
import { onFoot } from "../lib/data/activities";
import { db } from "../lib/db";
import { bestEfforts } from "../lib/garmin/efforts";

async function main() {
  const sql = db();
  console.log(`Database: ${new URL(process.env.DATABASE_URL!).hostname}`);
  const rows = await sql<{ activity_id: string; activity_type: string; series: unknown }[]>`
    select d.activity_id, a.activity_type, d.series
    from activity_details d join activities a on a.id = d.activity_id
    where d.efforts is null and d.series is not null`;
  let written = 0;
  for (const row of rows) {
    if (!onFoot(row.activity_type)) continue;
    const series = activitySeriesSchema.parse(row.series);
    const efforts = bestEfforts(series.t, series.d, series.cadence);
    await sql`update activity_details set efforts = ${sql.json(efforts as JSONValue)} where activity_id = ${row.activity_id}`;
    written++;
  }
  console.log(`Efforts written for ${written} on-foot activit${written === 1 ? "y" : "ies"}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
