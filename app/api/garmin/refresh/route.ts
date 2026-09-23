import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { isLoginSkipped } from "@/lib/supabase/dev-login";

const OWNER = "JuanRamirez2000";
const REPO = "fitness-tracker";
const WORKFLOW_FILE = "garmin-nightly.yml";
const API = `https://api.github.com/repos/${OWNER}/${REPO}/actions`;

// A GH Actions run takes ~20s end to end (checkout + pip install + the script itself, per
// the workflow's own real run history) — comfortably inside this budget.
const POLL_BUDGET_MS = 75_000;
const POLL_INTERVAL_MS = 2_500;

// The Hobby plan's default function timeout (60s) is shorter than POLL_BUDGET_MS above —
// this raises this one route's own ceiling so it isn't killed mid-poll.
export const maxDuration = 90;

/**
 * The "Refresh" button's endpoint (components/dashboard/garmin-refresh-button.tsx): pulls
 * TODAY only from Garmin, on demand, as opposed to the nightly GitHub Actions job which
 * only ever looks at yesterday (see .github/workflows/garmin-nightly.yml and
 * scripts/garmin/import_garmin.py's module docstring for why the two are split that way).
 *
 * Dispatches the same workflow with mode=today and polls it to completion — the app and the
 * Garmin import tooling are two different languages (Python + curl_cffi's TLS impersonation,
 * which nothing in the Next.js/Node world can substitute for), so this has to run on GitHub's
 * runners rather than in this route directly, whether that's called from a deployed server or
 * from `next dev` on a laptop. Needs GARMIN_REFRESH_TOKEN: a GitHub fine-grained PAT scoped
 * to just this repo with Actions: Read and write (see .env.example / the repo README).
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer && !isLoginSkipped()) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const token = process.env.GARMIN_REFRESH_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "GARMIN_REFRESH_TOKEN is not set." }, { status: 500 });
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const dispatchedAfter = new Date(Date.now() - 5_000).toISOString();
  const dispatchRes = await fetch(`${API}/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { mode: "today" } }),
  });
  if (!dispatchRes.ok) {
    return NextResponse.json(
      { ok: false, error: `GitHub couldn't start the import run (${dispatchRes.status}).` },
      { status: 502 },
    );
  }

  const deadline = Date.now() + POLL_BUDGET_MS;
  const run = await findDispatchedRun(headers, dispatchedAfter, deadline);
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "Started, but couldn't confirm it finished — check the repo's Actions tab." },
      { status: 202 },
    );
  }

  const conclusion = await waitForConclusion(headers, run.id, deadline);
  if (conclusion === "success") return NextResponse.json({ ok: true });
  if (conclusion === null) {
    return NextResponse.json(
      { ok: false, error: "Still running — check back in a bit." },
      { status: 202 },
    );
  }
  return NextResponse.json({ ok: false, error: `Import run ${conclusion}.` }, { status: 500 });
}

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
}

/** The dispatch endpoint returns no run id, so find it by asking what's new since we called it. */
async function findDispatchedRun(
  headers: Record<string, string>,
  dispatchedAfter: string,
  deadline: number,
): Promise<WorkflowRun | null> {
  while (Date.now() < deadline) {
    const res = await fetch(
      `${API}/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&branch=main&per_page=5`,
      { headers },
    );
    if (res.ok) {
      const { workflow_runs: runs } = (await res.json()) as { workflow_runs: WorkflowRun[] };
      const match = runs.find((run) => run.created_at >= dispatchedAfter);
      if (match) return match;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function waitForConclusion(
  headers: Record<string, string>,
  runId: number,
  deadline: number,
): Promise<string | null> {
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/runs/${runId}`, { headers });
    if (res.ok) {
      const run = (await res.json()) as WorkflowRun;
      if (run.status === "completed") return run.conclusion;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
