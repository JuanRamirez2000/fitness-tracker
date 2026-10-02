# Garmin Connect import

Pulls weigh-ins (body composition) and daily step counts from Garmin Connect via the unofficial
[`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
library and upserts them into Postgres as `source = 'garmin'` rows. It is
never a live part of the Next.js app itself: there is no official
personal-use Garmin API, and this is a real, ToS-adjacent dependency on
Garmin's undocumented web API.

This directory is its own Python project, isolated from the rest of the
repo: its own venv, its own `requirements.txt`. Nothing here is imported by
the Next.js app; `import_garmin.py` connects to Postgres directly with
`DATABASE_URL` (from the repo's `.env.local` locally, or a GitHub secret in
CI).

## One-time setup

1. **Python 3.13**, installed via `brew install python@3.13` (the system
   Python is 3.9, below the library's 3.12+ requirement).

2. **Create the venv and install dependencies** (re-run `pip install` after
   pulling a `requirements.txt` change):

   ```bash
   cd scripts/garmin
   /opt/homebrew/bin/python3.13 -m venv .venv --copies
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Log in. Run this yourself, interactively, once:**

   ```bash
   cd scripts/garmin
   source .venv/bin/activate
   python login_check.py
   ```

   Prompts for your Garmin email, password (hidden input) and an MFA code
   if your account has that on. Caches a token pair at
   `~/.garminconnect/garmin_tokens.json` (outside this repo) and pushes it
   to the `garmin_token_cache` table. Every run after this reuses and
   auto-refreshes that token.

## Running the import

```bash
source .venv/bin/activate
python import_garmin.py --yesterday     # the nightly job's own window
python import_garmin.py --days 1        # today only (the Refresh button's call)
python import_garmin.py --days 365      # a wider one-off backfill
python import_garmin.py --dry-run       # fetch + map, print, write nothing
```

Idempotent: weigh-ins are matched on Garmin's own per-record ID
(`external_id`, unique per `(user_id, source)` via `weigh_ins_source_uidx`)
and steps on their day, so re-running any window updates existing rows in
place rather than duplicating them.

## Where each window runs

- **Yesterday, nightly**: `.github/workflows/garmin-nightly.yml`, on GitHub's
  own runners, not this Mac. Scheduled for 1:00 AM PST (drifts an hour with
  daylight saving, see the workflow file's own comment). Looks at yesterday
  specifically, not "since last run", because Garmin's data can sync a day
  late and a fixed window run every night still catches it next time.
- **Today, on demand**: the dashboard's "Refresh" button (owner only;
  `components/dashboard/garmin-refresh-button.tsx` →
  `app/api/garmin/refresh/route.ts`). It dispatches the same workflow with
  `mode=today` (so it runs `--days 1`) and polls it to completion. Needs
  `GARMIN_REFRESH_TOKEN` (see `.env.example`): a fine-grained GitHub PAT
  scoped to just this repo with Actions: Read and write.
- **Anything else** (a backfill, a dry run): by hand, from this directory.

### Why GitHub Actions

This library needs Python and `curl_cffi`'s TLS impersonation to get past
Garmin's bot detection, which nothing in the Node/Vercel world can
substitute for. GitHub Actions is free, already tied to this repo, and
Python-capable. The Garmin login session lives in the `garmin_token_cache`
table (see `db/schema.sql`), not a local file or a GitHub secret, so the
nightly job and any local run share one session, and whichever refreshes
the token first is picked up by the other next time.

### Setup for the nightly job

The workflow needs one repository secret, the same **pooled** Neon
connection string the app uses:

```bash
gh secret set DATABASE_URL
```

The old `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`GARMIN_IMPORT_USER_ID` secrets are no longer read and can be deleted.

Trigger a run without waiting for the schedule: Actions tab → "Garmin
nightly import" → Run workflow (pick `mode`), or
`gh workflow run garmin-nightly.yml -f mode=today`.

## Worth knowing if this ever needs touching again

- **Partial unique index as an upsert target.** `weigh_ins_source_uidx` is
  `UNIQUE (...) WHERE external_id IS NOT NULL` (so a manual entry with no
  external_id never collides with another). Postgres only infers a partial
  index as the `ON CONFLICT` target when the same `WHERE` is repeated in
  the conflict clause, which is why `upsert_weigh_ins()` spells it out.
