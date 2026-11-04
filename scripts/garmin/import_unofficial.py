#!/usr/bin/env python3
"""Garmin import, unofficial half: the fields Garmin's official Personal API doesn't serve
(docs/garmin-fields.md). Everything else is imported by lib/garmin/ (TypeScript).

Datasets:
  readiness  training readiness: the day's latest snapshot (score, level, six factors,
             recovery time) plus the morning score -> daily_recovery's readiness columns.

Uses cyberjunky/python-garminconnect, which logs in like the Garmin Connect app. The login
session lives in ~/.garminconnect and is mirrored to the garmin_token_cache table, so a local
run and the GitHub Actions job (.github/workflows/garmin-unofficial.yml) share one session.
Run login_check.py by hand once if there is no valid session; this script never prompts.

Idempotent: rows are keyed by (user_id, local_date) and only this script's own columns are
updated, so the Personal API import's columns on the same row are never touched.

Usage:
    scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py              # last 7 days
    scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py --yesterday  # yesterday and today
    scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py --since 2026-09-01
    scripts/garmin/.venv/bin/python scripts/garmin/import_unofficial.py --dry-run

Config: DATABASE_URL from the environment, else the repo's .env.local.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

DEFAULT_DAYS = 7
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / ".env.local"
TOKEN_DIR = Path(os.getenv("GARMINTOKENS", "~/.garminconnect")).expanduser()
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"
DATASETS = ("readiness",)
PER_DAY_PAUSE_S = 0.4

# readiness_factors keys -> Garmin's field names (the hero's six rows).
READINESS_FACTORS = {
    "sleep_history": "sleepHistoryFactorPercent",
    "hrv": "hrvFactorPercent",
    "recovery_time": "recoveryTimeFactorPercent",
    "acwr": "acwrFactorPercent",
    "stress_history": "stressHistoryFactorPercent",
    "sleep": "sleepScoreFactorPercent",
}


# ---------- Pure mapping (tested in test_import_unofficial.py) ----------


def readiness_row(snapshots: list[dict[str, Any]] | dict[str, Any] | None) -> dict[str, Any] | None:
    """The day's readiness from its snapshots: the latest one (what the watch shows, and the
    one carrying the current recovery time), plus the after-wake snapshot's score."""
    if not snapshots:
        return None
    if isinstance(snapshots, dict):
        snapshots = [snapshots]
    scored = [s for s in snapshots if s.get("score") is not None and s.get("calendarDate")]
    if not scored:
        return None
    latest = max(scored, key=lambda s: s.get("timestamp") or "")
    morning = next((s for s in scored if s.get("inputContext") == "AFTER_WAKEUP_RESET"), None)
    recovery_min = latest.get("recoveryTime")
    timestamp = latest.get("timestamp")
    return {
        "local_date": latest["calendarDate"],
        "readiness_score": int(latest["score"]),
        "readiness_level": latest.get("level"),
        "readiness_factors": {key: latest.get(field) for key, field in READINESS_FACTORS.items()},
        # Garmin's timestamp is UTC without a zone ("2026-11-04T00:30:02.0").
        "readiness_at": f"{timestamp[:19]}Z" if timestamp else None,
        "readiness_morning_score": int(morning["score"]) if morning else None,
        "recovery_hours": round(recovery_min / 60, 1) if recovery_min is not None else None,
    }


def window(today: date, days: int, yesterday: bool, since: date | None) -> tuple[date, date]:
    """Readiness lands on the day it describes, so the nightly --yesterday run takes today too
    (like the Personal API import's sleep and recovery)."""
    if yesterday:
        return today - timedelta(days=1), today
    if since:
        return since, today
    return today - timedelta(days=max(days, 1) - 1), today


# ---------- Database and login ----------


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url and ENV_FILE.exists():
        from dotenv import dotenv_values

        url = dotenv_values(ENV_FILE).get("DATABASE_URL")
    if not url:
        sys.exit(f"DATABASE_URL is not set (environment or {ENV_FILE}).")
    return url


def pull_cached_token(conn, replace: bool = False) -> bool:
    """Restore the session saved in garmin_token_cache to the local token file. Without
    `replace`, only when there is no local file yet (a fresh CI runner)."""
    if TOKEN_FILE.exists() and not replace:
        return False
    row = conn.execute("select tokens from garmin_token_cache where id = 1").fetchone()
    if not row:
        return False
    TOKEN_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    TOKEN_FILE.write_text(json.dumps(row[0]))
    TOKEN_FILE.chmod(0o600)
    print(f"  restored the Garmin session from the database to {TOKEN_FILE}")
    return True


def push_cached_token(conn) -> None:
    """Save the (possibly just refreshed) session back, so the next run anywhere has it."""
    if not TOKEN_FILE.exists():
        return
    from psycopg.types.json import Jsonb

    conn.execute(
        """insert into garmin_token_cache (id, tokens, updated_at) values (1, %s, now())
           on conflict (id) do update set tokens = excluded.tokens, updated_at = now()""",
        (Jsonb(json.loads(TOKEN_FILE.read_text())),),
    )
    conn.commit()


def try_login():
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
        GarminConnectTooManyRequestsError,
    )

    try:
        client = Garmin()
        client.login(str(TOKEN_DIR))
        return client
    except GarminConnectTooManyRequestsError as err:
        sys.exit(f"Garmin rate-limited this request: {err}")
    except (GarminConnectAuthenticationError, GarminConnectConnectionError):
        return None


def login_garmin(conn):
    pull_cached_token(conn)
    client = try_login()
    # Whenever another run refreshes the session, the old refresh token stops working; the
    # database always holds the newest one, so retry with it.
    if client is None and pull_cached_token(conn, replace=True):
        client = try_login()
    if client is None:
        sys.exit(
            "No valid Garmin login (checked ~/.garminconnect and garmin_token_cache). Run once, "
            "by hand: scripts/garmin/.venv/bin/python scripts/garmin/login_check.py"
        )
    push_cached_token(conn)
    return client


def upsert_readiness(conn, user_id: str, rows: list[dict[str, Any]], dry_run: bool) -> None:
    if not rows:
        print("  readiness: nothing to write")
        return
    if dry_run:
        print(f"  readiness: would write {len(rows)} row(s) (dry run)")
        for row in rows[-3:]:
            print(f"    {row}")
        return
    from psycopg.types.json import Jsonb

    with conn.cursor() as cur:
        cur.executemany(
            """insert into daily_recovery (user_id, local_date, readiness_score, readiness_level,
                 readiness_factors, readiness_at, readiness_morning_score, recovery_hours)
               values (%(user_id)s, %(local_date)s, %(readiness_score)s, %(readiness_level)s,
                 %(readiness_factors)s, %(readiness_at)s, %(readiness_morning_score)s, %(recovery_hours)s)
               on conflict (user_id, local_date) do update set
                 readiness_score = excluded.readiness_score,
                 readiness_level = excluded.readiness_level,
                 readiness_factors = excluded.readiness_factors,
                 readiness_at = excluded.readiness_at,
                 readiness_morning_score = excluded.readiness_morning_score,
                 recovery_hours = excluded.recovery_hours,
                 updated_at = now()""",
            [{**r, "user_id": user_id, "readiness_factors": Jsonb(r["readiness_factors"])} for r in rows],
        )
    conn.commit()
    print(f"  readiness: upserted {len(rows)} row(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"trailing days ending today (default {DEFAULT_DAYS})")
    parser.add_argument("--yesterday", action="store_true", help="yesterday and today: the scheduled job's window")
    parser.add_argument("--since", type=date.fromisoformat, help="from this date (YYYY-MM-DD) through today")
    parser.add_argument("--only", choices=DATASETS, action="append", help="limit to these datasets (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="fetch and map, but write nothing")
    args = parser.parse_args()

    import psycopg

    with psycopg.connect(database_url(), prepare_threshold=None) as conn:
        profile = conn.execute("select id, timezone, display_name from profiles order by created_at limit 1").fetchone()
        if not profile:
            sys.exit("No profile row in the database yet. Run `npm run db:import` first.")
        user_id, tz, display_name = str(profile[0]), profile[1], profile[2]
        start, end = window(datetime.now(ZoneInfo(tz)).date(), args.days, args.yesterday, args.since)
        print(f"Account: {display_name} ({user_id})")
        print(f"Window: {start} .. {end} (tz {tz}){' — DRY RUN, nothing will be written' if args.dry_run else ''}")

        datasets = args.only or DATASETS
        garmin = login_garmin(conn)

        if "readiness" in datasets:
            rows = []
            day = start
            while day <= end:
                row = readiness_row(garmin.get_training_readiness(day.isoformat()))
                if row:
                    rows.append(row)
                day += timedelta(days=1)
                time.sleep(PER_DAY_PAUSE_S)
            print(f"Fetched readiness for {len(rows)} day(s)")
            upsert_readiness(conn, user_id, rows, args.dry_run)

    print("Done.")


if __name__ == "__main__":
    main()
