import "server-only";
import { addDays } from "@/lib/dates/calendar";
import type { Profile } from "@/lib/data/profiles";
import { fetchActivities, fetchActivityDetail, fetchActivitySummary, fetchRecovery, fetchSleepNights, fetchTraining } from "@/lib/data/queries";
import { importActivityDetails } from "@/lib/garmin/import-details";
import { buildActivityView, type ActivityView } from "./view";

/**
 * One activity's modal: the activity, its detail and the context rows around it. With
 * `fetchMissing` (the owner), an activity whose detail was never fetched is fetched from Garmin
 * first, so opening an old run fills it in; a viewer gets what's stored.
 */
export async function loadActivityView(profile: Profile, id: string, { fetchMissing }: { fetchMissing: boolean }): Promise<ActivityView | null> {
  // The id goes into uuid columns below; a malformed one is simply "no such activity".
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  // Everything that doesn't need the activity's day, in one round trip: the activity itself is
  // one of `activities` (which the view needs anyway, for its comparisons).
  const [activities, storedDetail, summary] = await Promise.all([
    fetchActivities(profile.id),
    fetchActivityDetail(profile.id, id),
    fetchActivitySummary(profile.id, id),
  ]);
  const activity = activities.find((a) => a.id === id);
  if (!activity) return null;
  const day = activity.local_date;

  let detail = storedDetail;
  if (!detail && fetchMissing) {
    try {
      await importActivityDetails({ target: { activityIds: [id] } });
      detail = await fetchActivityDetail(profile.id, id);
    } catch (err) {
      // Garmin down or rate-limiting: show the summary fields now; the next open tries again.
      console.error("Activity detail fetch failed:", err);
    }
  }

  // Then the day's context, in a second.
  const [recovery, sleep, training] = await Promise.all([
    fetchRecovery(profile.id, { from: day, to: day }),
    fetchSleepNights(profile.id, { from: day, to: day }),
    fetchTraining(profile.id, addDays(day, -1)),
  ]);
  return buildActivityView({
    activity,
    detail,
    activities,
    recovery: recovery[0] ?? null,
    sleep: sleep[0] ?? null,
    trainingBefore: training.at(-1) ?? null,
    profile,
    summary,
  });
}
