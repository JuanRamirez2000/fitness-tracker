#!/usr/bin/env python3
"""Garmin Connect import: weigh-ins (body composition) and daily step counts,
upserted into Postgres as source='garmin' rows.

Three ways this runs:
  - Nightly, in the cloud (GitHub Actions, .github/workflows/garmin-nightly.yml):
    `--yesterday` — the previous day only, once it's had all night to finish
    syncing from the scale to Garmin's servers. Does not depend on this Mac
    being on at all.
  - On demand, from the app's "Refresh" button (app/api/garmin/refresh/route.ts):
    `--days 1` — today only, whenever the button is clicked.
  - By hand, for a backfill: `--days N` for any other trailing window.

Idempotent: weigh_ins_source_uidx (db/schema.sql) is unique on
(user_id, source, external_id), and daily_steps is keyed by
(user_id, local_date), so re-running a day it already imported just
overwrites with the same values.

Garmin login session: cached tokens are pulled from and pushed back to the
garmin_token_cache table before and after every run, not just read from the
local ~/.garminconnect file — so a login made once, by hand, on this Mac
(login_check.py) is also usable by the nightly GitHub Actions job, which has
no local disk to persist a token on between runs.

This script never prompts for a Garmin password itself — it is meant to run
unattended. Run login_check.py by hand first if there's no valid session yet.

Config: DATABASE_URL, read from ../../.env.local locally or from the real
environment in CI (see the GitHub Actions workflow). The athlete is the one
profile row in the database.

Usage:
    source .venv/bin/activate
    python import_garmin.py --yesterday     # the nightly job's own window
    python import_garmin.py --days 1        # today only (the Refresh button's call)
    python import_garmin.py --days 365      # one-off historical backfill
    python import_garmin.py --dry-run       # fetch + map, print, write nothing
"""

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import dotenv_values
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)
import psycopg
from psycopg.types.json import Jsonb

GRAMS_PER_LB = 453.59237
DEFAULT_DAYS = 7
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / ".env.local"
TOKEN_DIR = Path("~/.garminconnect").expanduser()
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"

REQUIRED_CONFIG = ("DATABASE_URL",)


def load_config() -> dict[str, str]:
    # Locally, .env.local (gitignored) has this. In CI there is no such file — the GitHub
    # Actions workflow injects it as a real environment variable instead, from a repo secret.
    values = dict(dotenv_values(ENV_FILE)) if ENV_FILE.exists() else {}
    for key in REQUIRED_CONFIG:
        if not values.get(key) and os.environ.get(key):
            values[key] = os.environ[key]
    missing = [k for k in REQUIRED_CONFIG if not values.get(k)]
    if missing:
        sys.exit(
            f"Missing config: {', '.join(missing)}. Set them in {ENV_FILE} locally, "
            "or as environment variables (GitHub Actions secrets) in CI."
        )
    return values


def pull_cached_token(conn: psycopg.Connection) -> None:
    """Before login: if there's no local token file yet (a fresh GitHub Actions runner,
    every time — it has no persistent disk between runs), restore the last-known-good one
    from garmin_token_cache. A Mac that already has a local token keeps using it as-is,
    rather than risking clobbering a fresher local session with a stale remote one."""
    if TOKEN_FILE.exists():
        return
    row = conn.execute("select tokens from garmin_token_cache where id = 1").fetchone()
    if not row:
        return
    TOKEN_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    TOKEN_FILE.write_text(json.dumps(row[0]))
    TOKEN_FILE.chmod(0o600)
    print(f"  restored a cached Garmin session from the database to {TOKEN_FILE}")


def push_cached_token(conn: psycopg.Connection) -> None:
    """After a successful login (garminconnect may have just refreshed the token), save it
    back to garmin_token_cache so the next run — local or in CI — has the latest one."""
    if not TOKEN_FILE.exists():
        return
    tokens = json.loads(TOKEN_FILE.read_text())
    conn.execute(
        """insert into garmin_token_cache (id, tokens, updated_at) values (1, %s, now())
           on conflict (id) do update set tokens = excluded.tokens, updated_at = now()""",
        (Jsonb(tokens),),
    )
    conn.commit()


def login_garmin(conn: psycopg.Connection) -> Garmin:
    pull_cached_token(conn)
    try:
        client = Garmin()
        client.login(str(TOKEN_DIR))
    except GarminConnectTooManyRequestsError as err:
        sys.exit(f"Garmin rate-limited this request: {err}")
    except (GarminConnectAuthenticationError, GarminConnectConnectionError):
        sys.exit(
            "No valid Garmin login found (checked the local cache and garmin_token_cache). "
            "Run this once, by hand, in your own terminal:\n"
            "  source .venv/bin/activate && python login_check.py"
        )
    push_cached_token(conn)
    return client


def fetch_body(garmin: Garmin, start: date, end: date) -> dict:
    return garmin.get_body_composition(start.isoformat(), end.isoformat())


def fetch_steps(garmin: Garmin, start: date, end: date) -> list:
    return garmin.get_daily_steps(start.isoformat(), end.isoformat())


def build_steps_rows(user_id: str, steps: list) -> list[dict]:
    rows = []
    for day in steps:
        total = day.get("totalSteps")
        if total is None:
            continue
        rows.append({"user_id": user_id, "local_date": day["calendarDate"], "steps": int(total), "source": "garmin"})
    return rows


def build_weighin_rows(user_id: str, body: dict) -> list[dict]:
    rows = []
    for entry in body.get("dateWeightList", []):
        weight_lb = round(entry["weight"] / GRAMS_PER_LB, 1)
        if not (50 <= weight_lb <= 800):
            print(f"  note: skipping an out-of-range weigh-in ({weight_lb} lb on {entry.get('calendarDate')})")
            continue
        measured_at = datetime.fromtimestamp(entry["timestampGMT"] / 1000, tz=timezone.utc).isoformat()
        rows.append({
            "user_id": user_id,
            "measured_at": measured_at,
            "local_date": entry["calendarDate"],
            "weight_lb": weight_lb,
            "source": "garmin",
            "external_id": str(entry["samplePk"]),
        })
    return rows


def upsert_steps(conn: psycopg.Connection, rows: list[dict], dry_run: bool) -> None:
    if not rows:
        print("  daily_steps: nothing to write")
        return
    if dry_run:
        print(f"  daily_steps: would write {len(rows)} row(s) (dry run)")
        for row in rows[:3]:
            print(f"    {row}")
        return
    with conn.cursor() as cur:
        cur.executemany(
            """insert into daily_steps (user_id, local_date, steps, source, updated_at)
               values (%(user_id)s, %(local_date)s, %(steps)s, %(source)s, now())
               on conflict (user_id, local_date)
               do update set steps = excluded.steps, source = excluded.source, updated_at = now()""",
            rows,
        )
    conn.commit()
    print(f"  daily_steps: upserted {len(rows)} row(s)")


def upsert_weigh_ins(conn: psycopg.Connection, rows: list[dict], dry_run: bool) -> None:
    if not rows:
        print("  weigh_ins: nothing to write")
        return
    if dry_run:
        print(f"  weigh_ins: would write {len(rows)} row(s) (dry run)")
        for row in rows[:3]:
            print(f"    {row}")
        return
    # weigh_ins_source_uidx is a PARTIAL unique index (`where external_id is not null`, so a
    # manual entry with no external_id never collides), and Postgres only infers a partial
    # index as the conflict target when the same WHERE is repeated here.
    with conn.cursor() as cur:
        cur.executemany(
            """insert into weigh_ins (user_id, measured_at, local_date, weight_lb, source, external_id)
               values (%(user_id)s, %(measured_at)s, %(local_date)s, %(weight_lb)s, %(source)s, %(external_id)s)
               on conflict (user_id, source, external_id) where external_id is not null
               do update set measured_at = excluded.measured_at, local_date = excluded.local_date,
                             weight_lb = excluded.weight_lb""",
            rows,
        )
    conn.commit()
    print(f"  weigh_ins: upserted {len(rows)} row(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"trailing days to re-pull, ending today (default {DEFAULT_DAYS})")
    parser.add_argument("--yesterday", action="store_true", help="just yesterday — the nightly job's own window, distinct from --days")
    parser.add_argument("--dry-run", action="store_true", help="fetch and map, but write nothing")
    args = parser.parse_args()

    config = load_config()
    with psycopg.connect(config["DATABASE_URL"], prepare_threshold=None) as conn:
        profile = conn.execute(
            "select id, timezone, display_name from profiles order by created_at limit 1"
        ).fetchone()
        if not profile:
            sys.exit("No profile row in the database yet — run `npm run db:import` first.")
        user_id, tz, display_name = str(profile[0]), profile[1], profile[2]

        today = datetime.now(ZoneInfo(tz)).date()
        if args.yesterday:
            start = end = today - timedelta(days=1)
        else:
            start, end = today - timedelta(days=args.days - 1), today

        print(f"Account: {display_name} ({user_id})")
        print(f"Window: {start.isoformat()} .. {end.isoformat()} (tz {tz})")
        if args.dry_run:
            print("DRY RUN — nothing will be written.\n")

        garmin = login_garmin(conn)
        body = fetch_body(garmin, start, end)
        steps = fetch_steps(garmin, start, end)
        print(f"\nFetched from Garmin: {len(body.get('dateWeightList', []))} weigh-in(s), {len(steps)} step-day(s)")
        upsert_weigh_ins(conn, build_weighin_rows(user_id, body), args.dry_run)
        upsert_steps(conn, build_steps_rows(user_id, steps), args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
