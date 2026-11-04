/**
 * Garmin import by hand: backfills and dry runs (lib/garmin/import.ts does the work; the
 * nightly cron and the Refresh button call the same code).
 *
 *   npm run garmin:import -- --yesterday       # the nightly job's window
 *   npm run garmin:import -- --days 1          # today only (the Refresh button's window)
 *   npm run garmin:import -- --days 365        # a wider backfill
 *   npm run garmin:import -- --since 2024-01-01 --only activities   # run history alone
 *   npm run garmin:import -- --dry-run         # fetch and map, print, write nothing
 *
 * Default window: the last 7 days. `--only weigh-ins|steps|activities` (repeatable) narrows
 * what's pulled; use it for a backfill reaching before the program's start, since a weigh-in
 * from before then would move the start weight and the heatmap's first day.
 *
 * Reads GARMIN_PERSONAL_ACCESS_TOKEN and DATABASE_URL from .env.local; a variable already set
 * in the shell wins (`DATABASE_URL='<neon url>' npm run garmin:import -- ...`).
 */
import { parseArgs } from "node:util";
import { isLocalDate } from "../lib/dates/calendar";
import { db } from "../lib/db";
import { DATASETS, importGarmin, type Dataset, type ImportWindow } from "../lib/garmin/import";

async function main() {
  const { values } = parseArgs({
    options: {
      days: { type: "string" },
      yesterday: { type: "boolean", default: false },
      since: { type: "string" },
      only: { type: "string", multiple: true },
      "dry-run": { type: "boolean", default: false },
    },
  });

  let window: ImportWindow = { kind: "days", days: 7 };
  if (values.yesterday) window = { kind: "yesterday" };
  else if (values.since) {
    if (!isLocalDate(values.since)) throw new Error(`--since must be YYYY-MM-DD, got "${values.since}".`);
    window = { kind: "since", since: values.since };
  } else if (values.days) {
    const days = Number(values.days);
    if (!Number.isInteger(days) || days < 1) throw new Error(`--days must be a positive whole number, got "${values.days}".`);
    window = { kind: "days", days };
  }

  const only = values.only ?? [];
  const unknown = only.filter((d) => !(DATASETS as readonly string[]).includes(d));
  if (unknown.length) throw new Error(`--only must be one of ${DATASETS.join(", ")}; got ${unknown.join(", ")}.`);

  await importGarmin({
    window,
    datasets: only.length ? (only as Dataset[]) : DATASETS,
    dryRun: values["dry-run"],
    log: console.log,
  });
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
