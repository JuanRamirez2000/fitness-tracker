import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { isLoginSkipped } from "@/lib/supabase/dev-login";

const execFileAsync = promisify(execFile);

/**
 * The "Refresh" button's endpoint (components/dashboard/garmin-refresh-button.tsx): pulls
 * TODAY only from Garmin, on demand, as opposed to the nightly GitHub Actions job which
 * only ever looks at yesterday (see .github/workflows/garmin-nightly.yml and
 * scripts/garmin/import_garmin.py's module docstring for why the two are split that way).
 *
 * This shells out to the local scripts/garmin/.venv Python venv — the app and the import
 * tooling are two different languages, and this only works because both currently run on
 * the same Mac. Once the app is actually deployed (step 10), this route needs to instead
 * trigger the GitHub Actions workflow via workflow_dispatch (or an equivalent cloud call)
 * rather than a local subprocess, since a deployed server has no local Python venv and no
 * cached Garmin session to use.
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer && !isLoginSkipped()) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const scriptsDir = path.join(process.cwd(), "scripts", "garmin");
  const python = path.join(scriptsDir, ".venv", "bin", "python3");
  const script = path.join(scriptsDir, "import_garmin.py");

  try {
    const { stdout } = await execFileAsync(python, [script, "--days", "1"], {
      cwd: scriptsDir,
      timeout: 45_000,
    });
    return NextResponse.json({ ok: true, output: stdout });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
