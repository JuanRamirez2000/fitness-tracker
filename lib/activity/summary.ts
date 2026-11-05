import "server-only";
import type { DayWindow } from "@/lib/dates/calendar";
import type { Profile } from "@/lib/data/profiles";
import { fetchActivityIdsWithoutSummary, saveActivitySummary, type ActivitySummary } from "@/lib/data/queries";
import { ACTIVITY_SYSTEM, activityFacts, activityUserMessage } from "@/lib/summary/activity";
import { SUMMARY_MODEL, callGemini } from "@/lib/summary/generate";
import { loadActivityView } from "./load";

/**
 * Writes one activity's AI summary from the modal's own view (one Gemini call, retried when
 * busy) and stores it. Fetches the activity's detail first if it was never fetched, so the
 * summary can speak to the splits. Returns why nothing was written when Gemini declined.
 */
export async function writeActivitySummary(
  profile: Profile,
  activityId: string,
  { log = () => {} }: { log?: (line: string) => void } = {},
): Promise<ActivitySummary | { skipped: string }> {
  const view = await loadActivityView(profile, activityId, { fetchMissing: true });
  if (!view) return { skipped: "no such activity" };
  const call = await callGemini(SUMMARY_MODEL, ACTIVITY_SYSTEM, activityUserMessage(activityFacts(view)), fetch);
  if ("skipped" in call) {
    log(`[activity ${view.date} ${view.name}] ${call.skipped}; nothing written.`);
    return call;
  }
  log(`[activity ${view.date} ${view.name}] ${call.text}`);
  return saveActivitySummary(profile.id, activityId, call.text, call.modelVersion);
}

/**
 * Summaries for every activity in `range` that has none (the morning cron: yesterday and
 * today). One activity failing leaves the rest to run.
 */
export async function writeMissingActivitySummaries(
  profile: Profile,
  range: DayWindow,
  { log = () => {} }: { log?: (line: string) => void } = {},
): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;
  for (const id of await fetchActivityIdsWithoutSummary(profile.id, range)) {
    try {
      const result = await writeActivitySummary(profile, id, { log });
      if ("skipped" in result) failed++;
      else written++;
    } catch (err) {
      failed++;
      log(`[activity ${id}] ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { written, failed };
}
