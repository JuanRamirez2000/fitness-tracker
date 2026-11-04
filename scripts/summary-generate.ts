/**
 * Writes today's AI summaries by hand, one per tab (the morning cron, app/api/summary/cron,
 * does the same after importing). Reads GEMINI_API_KEY and DATABASE_URL from .env.local.
 *
 *   npm run summary:generate                           # all three tabs
 *   npm run summary:generate -- --tab weight           # one tab (repeatable)
 *   npm run summary:generate -- --dry-run              # print facts and text, write nothing
 */
import { parseArgs } from "node:util";
import type { TabKey } from "../lib/dashboard/types";
import { db } from "../lib/db";
import { SUMMARY_TABS, generateSummaries } from "../lib/summary/generate";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    tab: { type: "string", multiple: true },
  },
});

const tabs = values.tab ?? SUMMARY_TABS;
const unknown = tabs.filter((t) => !(SUMMARY_TABS as string[]).includes(t));
if (unknown.length) {
  console.error(`--tab must be one of ${SUMMARY_TABS.join(", ")}; got ${unknown.join(", ")}.`);
  process.exit(1);
}

generateSummaries({ tabs: tabs as TabKey[], dryRun: values["dry-run"], log: console.log })
  .then((results) => {
    for (const r of results) console.log(`${r.tab}: ${r.text ? "written" : `nothing written (${r.skipped})`}`);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
