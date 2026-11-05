import "server-only";
import { addDays } from "@/lib/dates/calendar";
import type { Profile } from "@/lib/data/profiles";
import { fetchActivities, fetchActivity, fetchActivityDetail, fetchActivitySummary, fetchRecovery, fetchSleepNights, fetchTraining } from "@/lib/data/queries";
import { importActivityDetails } from "@/lib/garmin/import-details";
import { buildActivityView, type ActivityView } from "./view";

/**
 * One activity's modal: the activity, its detail and the context rows around it. With
 * `fetchMissing` (the owner), an activity whose detail was never fetched is fetched from Garmin
 * first, so opening an old run fills it in; a viewer gets what's stored.
 */
export async function loadActivityView(profile: Profile, id: string, { fetchMissing }: { fetchMissing: boolean }): Promise<ActivityView | null> {
  const activity = await fetchActivity(profile.id, id);
  if (!activity) return null;
  const day = activity.local_date;

  let detail = await fetchActivityDetail(profile.id, id);
  if (!detail && fetchMissing) {
    try {
      await importActivityDetails({ target: { activityIds: [id] } });
      detail = await fetchActivityDetail(profile.id, id);
    } catch (err) {
      // Garmin down or rate-limiting: show the summary fields now; the next open tries again.
      console.error("Activity detail fetch failed:", err);
    }
  }

  const [activities, recovery, sleep, training, summary] = await Promise.all([
    fetchActivities(profile.id),
    fetchRecovery(profile.id, { from: day, to: day }),
    fetchSleepNights(profile.id, { from: day, to: day }),
    fetchTraining(profile.id, addDays(day, -1)),
    fetchActivitySummary(profile.id, id),
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
