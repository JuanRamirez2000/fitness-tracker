/**
 * Garmin import by hand: backfills and dry runs (lib/garmin/import.ts does the work; the
 * nightly cron and the Refresh button call the same code).
 *
 *   npm run garmin:import -- --yesterday       # the nightly job's window
 *   npm run garmin:import -- --days 1          # today only (the Refresh button's window)
 *   npm run garmin:import -- --days 365        # a wider backfill
 *   npm run garmin:import -- --since 2024-01-01 --only activities   # run history alone
 *   npm run garmin:import -- --since 2024-01-01 --only details      # samples and splits for those runs
 *   npm run garmin:import -- --since 2026-01-01 --only details --refresh-details --sport ride   # refetch rides' detail
 *   npm run garmin:import -- --dry-run         # fetch and map, print, write nothing
 *
 * Default window: the last 7 days. `--only <dataset>` (repeatable; see DATASETS in lib/garmin/import.ts) narrows
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
      "refresh-details": { type: "boolean", default: false },
      sport: { type: "string" },
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

  if (values.sport && values.sport !== "ride" && values.sport !== "run") throw new Error(`--sport must be ride or run, got "${values.sport}".`);
  const only = values.only ?? [];
  const unknown = only.filter((d) => !(DATASETS as readonly string[]).includes(d));
  if (unknown.length) throw new Error(`--only must be one of ${DATASETS.join(", ")}; got ${unknown.join(", ")}.`);

  const result = await importGarmin({
    window,
    datasets: only.length ? (only as Dataset[]) : DATASETS,
    dryRun: values["dry-run"],
    log: console.log,
    // Two requests per activity: pace a long detail backfill under Garmin's rate limit.
    detailDelayMs: 1500,
    refreshDetails: values["refresh-details"],
    detailSport: values.sport as "ride" | "run" | undefined,
  });
  if (result.details?.remaining) {
    // Partial: what was fetched is saved. Exit non-zero so a retry loop knows to run again.
    console.log(`Stopped with ${result.details.remaining} activities still to fetch; run again later.`);
    process.exitCode = 1;
    return;
  }
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
