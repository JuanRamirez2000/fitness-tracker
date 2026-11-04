# Garmin import, unofficial half

Garmin's official Personal API (imported by `lib/garmin/`, TypeScript) doesn't serve training
readiness, training status, load focus, race predictions or daily VO2 max. This folder
imports those with the unofficial
[`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
library, which logs in like the Garmin Connect app. Field paths: `docs/garmin-fields.md`.

## Setup (once)

```bash
/opt/homebrew/bin/python3.13 -m venv scripts/garmin/.venv --copies
scripts/garmin/.venv/bin/pip install -r scripts/garmin/requirements.txt
scripts/garmin/.venv/bin/python scripts/garmin/login_check.py
```

`login_check.py` asks for your Garmin email, password and MFA code (only when there is no
valid session yet), caches the session in `~/.garminconnect`, and copies it to the
`garmin_token_cache` table of `.env.local`'s `DATABASE_URL`. To give the scheduled job the
session, run it once against production:

```bash
DATABASE_URL='<neon url>' scripts/garmin/.venv/bin/python scripts/garmin/login_check.py
```

## Running

```bash
scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py              # last 7 days
scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py --yesterday  # yesterday and today
scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py --since 2026-09-01
scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py --dry-run
```

Scheduled: `.github/workflows/garmin-unofficial.yml`, mornings and late evenings (Pacific),
with the repo secret `DATABASE_URL`. Run it by hand from the Actions tab or
`gh workflow run garmin-unofficial.yml`.

Tests: `scripts/garmin/.venv/bin/python -m unittest discover -s scripts/garmin`.

Idempotent: rows are keyed by day and only this script's columns are updated, so it never
overwrites what the Personal API import wrote to the same row.
