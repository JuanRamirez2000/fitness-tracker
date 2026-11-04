/**
 * Writes today's AI daily summary by hand (the morning cron, app/api/summary/cron, does the
 * same after importing). Reads GEMINI_API_KEY and DATABASE_URL from .env.local.
 *
 *   npm run summary:generate              # write today's summary
 *   npm run summary:generate -- --dry-run # print the facts and the summary, write nothing
 */
import { parseArgs } from "node:util";
import { db } from "../lib/db";
import { generateDailySummary } from "../lib/summary/generate";

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });

generateDailySummary({ dryRun: values["dry-run"], log: console.log })
  .then((result) => console.log(result.text ? "Done." : `Nothing written: ${result.skipped}.`))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
