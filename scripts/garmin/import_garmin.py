#!/usr/bin/env python3
"""Garmin Connect import: weigh-ins (body composition), daily step counts and
activities (workouts), upserted into Postgres as source='garmin' rows.

Three ways this runs:
  - Nightly, in the cloud (GitHub Actions, .github/workflows/garmin-nightly.yml):
    `--yesterday` — the previous day only, once it's had all night to finish
    syncing from the scale to Garmin's servers. Does not depend on this Mac
    being on at all.
  - On demand, from the app's "Refresh" button (app/api/garmin/refresh/route.ts):
    `--days 1` — today only, whenever the button is clicked.
  - By hand, for a backfill: `--days N` or `--since YYYY-MM-DD` for any other
    window, optionally narrowed with `--only` (e.g. run history alone).

Idempotent: weigh_ins_source_uidx (db/schema.sql) is unique on
(user_id, source, external_id), activities is unique on the same three
columns, and daily_steps is keyed by
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
    python import_garmin.py --since 2025-01-01 --only activities   # run history alone
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
DATASETS = ("weigh-ins", "steps", "activities")


def load_config() -> dict[str, str]:
    # A real environment variable wins (CI's repo secret, or a one-off
    # `DATABASE_URL=... python import_garmin.py`); .env.local (gitignored) is the fallback.
    values = dict(dotenv_values(ENV_FILE)) if ENV_FILE.exists() else {}
    for key in REQUIRED_CONFIG:
        if os.environ.get(key):
            values[key] = os.environ[key]
    missing = [k for k in REQUIRED_CONFIG if not values.get(k)]
    if missing:
        sys.exit(
            f"Missing config: {', '.join(missing)}. Set them in {ENV_FILE} locally, "
            "or as environment variables (GitHub Actions secrets) in CI."
        )
    return values


def pull_cached_token(conn: psycopg.Connection, replace: bool = False) -> bool:
    """Restore the session saved in garmin_token_cache to the local token file. Without
    `replace`, only when there is no local file yet (a fresh GitHub Actions runner, every
    time); a Mac that already has one keeps it rather than risk clobbering a fresher local
    session. Returns whether it wrote the file."""
    if TOKEN_FILE.exists() and not replace:
        return False
    row = conn.execute("select tokens from garmin_token_cache where id = 1").fetchone()
    if not row:
        return False
    TOKEN_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    TOKEN_FILE.write_text(json.dumps(row[0]))
    TOKEN_FILE.chmod(0o600)
    print(f"  restored a cached Garmin session from the database to {TOKEN_FILE}")
    return True


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


def try_login() -> Garmin | None:
    try:
        client = Garmin()
        client.login(str(TOKEN_DIR))
        return client
    except GarminConnectTooManyRequestsError as err:
        sys.exit(f"Garmin rate-limited this request: {err}")
    except (GarminConnectAuthenticationError, GarminConnectConnectionError):
        return None


def login_garmin(conn: psycopg.Connection) -> Garmin:
    pull_cached_token(conn)
    client = try_login()
    # The local file can go stale: whenever the nightly job refreshes the session, the old
    # refresh token stops working. The database always holds the newest one, so retry with it.
    if client is None and pull_cached_token(conn, replace=True):
        client = try_login()
    if client is None:
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


def fetch_activities(garmin: Garmin, start: date, end: date) -> list:
    return garmin.get_activities_by_date(start.isoformat(), end.isoformat())


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


def build_activity_rows(user_id: str, activities: list) -> list[dict]:
    rows = []
    for a in activities:
        if not a.get("activityId") or not a.get("startTimeGMT") or not a.get("startTimeLocal"):
            continue
        # Garmin sends both clocks as "YYYY-MM-DD HH:MM:SS"; the local one's date is the
        # athlete's own day, so local_date never has to be derived from UTC.
        started_at = datetime.fromisoformat(a["startTimeGMT"]).replace(tzinfo=timezone.utc).isoformat()
        rows.append({
            "user_id": user_id,
            "external_id": str(a["activityId"]),
            "activity_type": (a.get("activityType") or {}).get("typeKey") or "other",
            "name": a.get("activityName"),
            "started_at": started_at,
            "local_date": a["startTimeLocal"][:10],
            "duration_s": a.get("duration") or 0,
            "moving_duration_s": a.get("movingDuration"),
            "distance_m": a.get("distance"),
            "elevation_gain_m": a.get("elevationGain"),
            "avg_speed_mps": a.get("averageSpeed"),
            "avg_grade_adjusted_speed_mps": a.get("avgGradeAdjustedSpeed"),
            "avg_hr": round(a["averageHR"]) if a.get("averageHR") else None,
            "max_hr": round(a["maxHR"]) if a.get("maxHR") else None,
            "avg_cadence_spm": a.get("averageRunningCadenceInStepsPerMinute"),
            "avg_stride_cm": a.get("avgStrideLength"),
            "avg_ground_contact_ms": a.get("avgGroundContactTime"),
            "calories": round(a["calories"]) if a.get("calories") else None,
            "aerobic_training_effect": a.get("aerobicTrainingEffect"),
            "training_effect_label": a.get("trainingEffectLabel"),
            "training_load": a.get("activityTrainingLoad"),
            "vo2max": round(a["vO2MaxValue"]) if a.get("vO2MaxValue") else None,
            "fastest_mile_s": a.get("fastestSplit_1609"),
        })
    return rows


ACTIVITY_COLUMNS = (
    "activity_type", "name", "started_at", "local_date", "duration_s", "moving_duration_s", "distance_m",
    "elevation_gain_m", "avg_speed_mps", "avg_grade_adjusted_speed_mps", "avg_hr", "max_hr", "avg_cadence_spm",
    "avg_stride_cm", "avg_ground_contact_ms", "calories", "aerobic_training_effect", "training_effect_label",
    "training_load", "vo2max", "fastest_mile_s",
)


def upsert_activities(conn: psycopg.Connection, rows: list[dict], dry_run: bool) -> None:
    if not rows:
        print("  activities: nothing to write")
        return
    if dry_run:
        print(f"  activities: would write {len(rows)} row(s) (dry run)")
        for row in rows[:3]:
            print(f"    {row}")
        return
    columns = ", ".join(ACTIVITY_COLUMNS)
    values = ", ".join(f"%({c})s" for c in ACTIVITY_COLUMNS)
    updates = ", ".join(f"{c} = excluded.{c}" for c in ACTIVITY_COLUMNS)
    with conn.cursor() as cur:
        cur.executemany(
            f"""insert into activities (user_id, source, external_id, {columns})
                values (%(user_id)s, 'garmin', %(external_id)s, {values})
                on conflict (user_id, source, external_id)
                do update set {updates}, updated_at = now()""",
            rows,
        )
    conn.commit()
    print(f"  activities: upserted {len(rows)} row(s)")


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
    parser.add_argument("--since", type=date.fromisoformat, help="re-pull from this date (YYYY-MM-DD) through today, instead of --days")
    parser.add_argument(
        "--only", choices=DATASETS, action="append",
        help="limit the import to these datasets (repeatable); e.g. a run-history backfill with "
             "--only activities, so years-old weigh-ins never land before the program's start",
    )
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
        elif args.since:
            start, end = args.since, today
        else:
            start, end = today - timedelta(days=args.days - 1), today

        print(f"Account: {display_name} ({user_id})")
        print(f"Window: {start.isoformat()} .. {end.isoformat()} (tz {tz})")
        if args.dry_run:
            print("DRY RUN — nothing will be written.\n")

        datasets = args.only or DATASETS
        garmin = login_garmin(conn)
        print()
        if "weigh-ins" in datasets:
            body = fetch_body(garmin, start, end)
            print(f"Fetched {len(body.get('dateWeightList', []))} weigh-in(s)")
            upsert_weigh_ins(conn, build_weighin_rows(user_id, body), args.dry_run)
        if "steps" in datasets:
            steps = fetch_steps(garmin, start, end)
            print(f"Fetched {len(steps)} step-day(s)")
            upsert_steps(conn, build_steps_rows(user_id, steps), args.dry_run)
        if "activities" in datasets:
            activities = fetch_activities(garmin, start, end)
            print(f"Fetched {len(activities)} activit{'y' if len(activities) == 1 else 'ies'}")
            upsert_activities(conn, build_activity_rows(user_id, activities), args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
