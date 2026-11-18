/**
 * Writes today's AI summaries by hand, one per tab (the morning cron, app/api/summary/cron,
 * does the same after importing), or the Progress tab's weekly review. Reads GEMINI_API_KEY and
 * DATABASE_URL from .env.local.
 *
 *   npm run summary:generate                           # all three tabs
 *   npm run summary:generate -- --tab weight           # one tab (repeatable)
 *   npm run summary:generate -- --weekly               # the weekly review the morning run writes
 *   npm run summary:generate -- --weekly --week 2026-11-09   # a given week (final once it's over)
 *   npm run summary:generate -- --dry-run              # print facts and text, write nothing
 */
import { parseArgs } from "node:util";
import { isLocalDate, mondayOf } from "../lib/dates/calendar";
import { db } from "../lib/db";
import { SUMMARY_TABS, generateSummaries, type SummaryTab } from "../lib/summary/generate";
import { writeWeeklySummary } from "../lib/summary/weekly";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    tab: { type: "string", multiple: true },
    weekly: { type: "boolean", default: false },
    week: { type: "string" },
  },
});

async function main() {
  if (values.weekly) {
    if (values.week && !isLocalDate(values.week)) throw new Error("--week takes a date, YYYY-MM-DD.");
    // A past week is written final; the current one so far (writeWeeklySummary checks).
    const target = values.week ? { monday: mondayOf(values.week), final: true } : undefined;
    const r = await writeWeeklySummary({ target, dryRun: values["dry-run"], log: console.log });
    console.log(`weekly ${r.week}${r.final ? " (final)" : " (so far)"}: ${r.headline ? "written" : `nothing written (${r.skipped})`}`);
    return;
  }
  const tabs = values.tab ?? SUMMARY_TABS;
  const unknown = tabs.filter((t) => !(SUMMARY_TABS as string[]).includes(t));
  if (unknown.length) throw new Error(`--tab must be one of ${SUMMARY_TABS.join(", ")}; got ${unknown.join(", ")}.`);
  const results = await generateSummaries({ tabs: tabs as SummaryTab[], dryRun: values["dry-run"], log: console.log });
  for (const r of results) console.log(`${r.tab}: ${r.text ? "written" : `nothing written (${r.skipped})`}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db().end());
