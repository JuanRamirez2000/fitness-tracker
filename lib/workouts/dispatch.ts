import "server-only";

/**
 * Asks GitHub Actions to run .github/workflows/garmin-push.yml now, which sends every queued
 * workout to the Garmin calendar (scripts/garmin/push_workout.py --pending). The web app can't
 * do it itself: only the Python Garmin login works, and only from GitHub's runners.
 *
 * Needs GITHUB_DISPATCH_TOKEN: a fine-grained token for this one repo with "Actions: read and
 * write". Without it nothing fails: queued workouts go out on the twice-daily Garmin import run.
 */

const REPO = process.env.GITHUB_REPOSITORY ?? "JuanRamirez2000/fitness-tracker";
const WORKFLOW = "garmin-push.yml";

export type DispatchResult = { dispatched: true } | { dispatched: false; reason: string };

export async function dispatchPush(): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { dispatched: false, reason: "no GITHUB_DISPATCH_TOKEN" };
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
      cache: "no-store",
    });
    if (res.status === 204) return { dispatched: true };
    const text = await res.text().catch(() => "");
    console.error("GitHub dispatch failed:", res.status, text.slice(0, 300));
    return { dispatched: false, reason: `GitHub answered ${res.status}` };
  } catch (err) {
    console.error("GitHub dispatch failed:", err);
    return { dispatched: false, reason: "couldn't reach GitHub" };
  }
}
