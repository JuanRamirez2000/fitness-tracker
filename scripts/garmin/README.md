# Garmin Connect import

Pulls real steps/weight/activity data from Garmin Connect via the unofficial
[`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
library and upserts it into Supabase as `source = 'garmin'` rows — never a
live part of the Next.js app itself (see the project memory note on why: no
official personal-use API exists, and this is a real, if actively
maintained, ToS-adjacent dependency on Garmin's undocumented web API).

This directory is its own Python project, isolated from the rest of the
repo: its own venv, its own `requirements.txt`. Nothing here is imported by
the Next.js app; `import_garmin.py` talks to Supabase directly with the
service-role key, the same way `scripts/seed-demo.ts` does on the
TypeScript side (and reads the exact same `.env.seed.local`).

## One-time setup

1. **Python 3.13**, installed via `brew install python@3.13` — the repo's
   system Python was 3.9, below the library's 3.12+ requirement.

2. **Create the venv and install dependencies** (already done once; re-run
   if the venv ever gets deleted):

   ```bash
   cd scripts/garmin
   /opt/homebrew/bin/python3.13 -m venv .venv --copies
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Log in — run this yourself, interactively, once:**

   ```bash
   cd scripts/garmin
   source .venv/bin/activate
   python login_check.py
   ```

   Prompts for your Garmin email, password (hidden input) and an MFA code
   if your account has that on. Caches a token pair at
   `~/.garminconnect/garmin_tokens.json` (outside this repo). Every script
   after this reuses and auto-refreshes that token — you shouldn't need to
   log in again unless you explicitly log out or the refresh token itself
   expires.

## Running the import

```bash
source .venv/bin/activate
python import_garmin.py --yesterday     # the nightly job's own window
python import_garmin.py --days 1        # today only (the Refresh button's call)
python import_garmin.py --days 365      # a wider one-off backfill
python import_garmin.py --dry-run       # fetch + map, print, write nothing
```

Idempotent by design: `weigh_ins`/`activities` are matched on Garmin's own
per-record ID (`external_id`) and `daily_metrics` on its
`(user_id, local_date, metric)` primary key, so re-running any window is
always safe — it updates existing rows in place rather than duplicating.

## Where each window runs

- **Yesterday, nightly**: `.github/workflows/garmin-nightly.yml`, on GitHub's
  own runners — not this Mac. Scheduled for 1:00 AM PST (drifts an hour
  with daylight saving, see the workflow file's own comment). Looks at
  yesterday specifically, not "since last run", because Garmin's own data
  can sync a day or two late and a fixed one-day window run every night
  still catches that the next night or the one after.
- **Today, on demand**: the dashboard's "Refresh" button
  (`components/dashboard/garmin-refresh-button.tsx` →
  `app/api/garmin/refresh/route.ts`), for "I just logged a run and want it
  to show up now" rather than waiting. Same as the nightly job: dispatches
  `.github/workflows/garmin-nightly.yml` (with `mode=today`, so it runs
  `--days 1` instead of `--yesterday`) and polls it to completion, rather
  than running the script in-process — needs a `GARMIN_REFRESH_TOKEN` (see
  `.env.example`), a fine-grained GitHub PAT scoped to just this repo with
  Actions: Read and write, since dispatching and polling a workflow run
  needs its own auth distinct from `gh`'s local CLI session.
- **Anything else** (a backfill, a dry run): by hand, from this directory.

### Why GitHub Actions and not literally a Supabase feature

Supabase's own compute (Edge Functions) is Deno/TypeScript-only and cannot
run this Python library or its `curl_cffi`-based TLS impersonation, which
is what gets past Garmin's bot detection — there's no way to run
`garminconnect` *inside* Supabase. GitHub Actions is the practical
substitute: free, already tied to this repo, and Python-capable. Supabase
still does the part that matters for "not tied to one machine": the
Garmin login session lives in the `garmin_token_cache` table (see
`supabase/schema.sql`), not a local file or a GitHub secret, so the nightly
job and any local run share one session and whichever refreshes the token
first is picked up by the other next time.

### One-time setup for the nightly job

The workflow needs three repository secrets (Settings → Secrets and
variables → Actions → New repository secret, or `gh secret set`) — **not
yet set, since setting secrets is outside what this session's tooling is
allowed to do on your behalf:**

```bash
gh secret set SUPABASE_URL --body "$(grep NEXT_PUBLIC_SUPABASE_URL .env.seed.local | cut -d= -f2-)"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$(grep SUPABASE_SERVICE_ROLE_KEY .env.seed.local | cut -d= -f2-)"
gh secret set GARMIN_IMPORT_USER_ID --body "$(grep SEED_USER_ID .env.seed.local | cut -d= -f2-)"
```

Until those are set, the scheduled run (and the Refresh button, and any
manual `gh workflow run`) will fail — they all run as this same GitHub
Actions job now, so they share this one setup step. (As of 2026-09-23,
these are set — the nightly job and manual dispatches both run clean.)

Trigger a run without waiting for the schedule: Actions tab → "Garmin
nightly import" → Run workflow (pick `mode`), or
`gh workflow run garmin-nightly.yml -f mode=today`.

There is no local nightly job anymore — the macOS LaunchAgent from the
previous version of this setup has been removed
(`launchctl bootout` + deleted the plist).

## Real bugs this hit and fixed (2026-09-22, worth knowing if this ever needs touching again)

- **Partial unique index + PostgREST upsert don't mix.** `weigh_ins_source_uidx`
  and `activities_source_uidx` are both `UNIQUE (...) WHERE external_id IS NOT
  NULL` (so a plain manual entry with no external_id never collides with
  another). Postgres can only infer a partial index as an `ON CONFLICT`
  target when the same `WHERE` clause is repeated in the conflict clause
  itself, which PostgREST's `on_conflict=` query param has no way to
  express — every upsert against these two tables failed with `42P10: no
  unique or exclusion constraint matching the ON CONFLICT specification`.
  Fixed by doing the equivalent by hand in `upsert_by_external_id()`: look
  up which external_ids already exist for `source='garmin'`, insert the
  new ones, update the rest by their real row id. `daily_metrics` doesn't
  have this problem — its primary key isn't partial, so the plain
  `.upsert(on_conflict=...)` call works there.
- **A sub-30-second Garmin "activity" rounds to 0 duration minutes**, which
  violates `activities.duration_min`'s `> 0` check. Fixed with a `max(1,
  ...)` floor rather than the literal rounded value.

## Status

- [x] Python 3.13, venv, `garminconnect` + `curl_cffi` + `supabase` +
      `python-dotenv` installed (`requirements.txt` pinned).
- [x] `login_check.py` — run once by the user, confirmed working; also
      pushes the session to `garmin_token_cache` so the cloud job can use
      it immediately.
- [x] `import_garmin.py` — writes steps, weigh-ins and activities.
      Real-data backfill run once (700-day window, all data Garmin has:
      594 step-days, 472 weigh-ins, 226 activities).
- [x] The account's demo-seeded `weigh_ins`/`daily_metrics`/`activities`
      rows were deleted first (user's choice) so the dashboard is now 100%
      real data for these three tables — `nutrition_days` and `injections`
      (calorie tracking, shots) still hold their original demo history,
      since Garmin has no data to replace those with.
- [x] "Refresh" button in the dashboard header — dispatches
      `garmin-nightly.yml` with `mode=today` and polls it to completion, so
      it works the same way from a deployed server as from a laptop.
- [x] `.github/workflows/garmin-nightly.yml` — `mode=yesterday` (nightly
      default) or `mode=today` (the Refresh button), once a night or on
      demand. Written and the local launchd equivalent removed.
- [x] The nightly workflow's 3 repo secrets are set (2026-09-23) — both the
      schedule and manual dispatches run clean.
- [ ] `GARMIN_REFRESH_TOKEN` (a GitHub fine-grained PAT, Actions: Read and
      write, scoped to this repo only) needs to be created and set in both
      `.env.local` and Vercel's production env vars before the Refresh
      button itself will work — see `.env.example`.
