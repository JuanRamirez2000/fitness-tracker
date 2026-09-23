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
python import_garmin.py                # last 7 days (the nightly default)
python import_garmin.py --days 365      # a wider one-off backfill
python import_garmin.py --dry-run       # fetch + map, print, write nothing
```

Idempotent by design: `weigh_ins`/`activities` are matched on Garmin's own
per-record ID (`external_id`) and `daily_metrics` on its
`(user_id, local_date, metric)` primary key, so re-running any window is
always safe — it updates existing rows in place rather than duplicating.
Every run re-pulls a trailing window (not "since last run") because
Garmin's own data can sync a day or two late.

## Nightly schedule

A macOS LaunchAgent (`~/Library/LaunchAgents/com.tracker.garmin-import.plist`,
not part of this repo — it lives in your user Library) runs
`import_garmin.py` with the default 7-day window every night at 3:00 AM. If
the Mac is asleep or off at that time, launchd runs it at the next wake
instead of skipping it.

```bash
# Check it's loaded
launchctl print gui/$(id -u)/com.tracker.garmin-import

# Run it right now, without waiting for 3 AM
launchctl kickstart -p gui/$(id -u)/com.tracker.garmin-import

# Read the last run's output
tail -50 import.log

# Turn it off (keeps the plist; nothing runs until you load it again)
launchctl bootout gui/$(id -u)/com.tracker.garmin-import

# Turn it back on
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.tracker.garmin-import.plist

# Remove entirely
launchctl bootout gui/$(id -u)/com.tracker.garmin-import
rm ~/Library/LaunchAgents/com.tracker.garmin-import.plist
```

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
- [x] `login_check.py` — run once by the user, confirmed working.
- [x] `import_garmin.py` — writes steps, weigh-ins and activities.
      Real-data backfill run once (700-day window, all data Garmin has:
      594 step-days, 472 weigh-ins, 226 activities).
- [x] The account's demo-seeded `weigh_ins`/`daily_metrics`/`activities`
      rows were deleted first (user's choice) so the dashboard is now 100%
      real data for these three tables — `nutrition_days` and `injections`
      (calorie tracking, shots) still hold their original demo history,
      since Garmin has no data to replace those with.
- [x] Nightly launchd schedule set up and test-triggered successfully
      (3:00 AM daily, 7-day trailing window).
