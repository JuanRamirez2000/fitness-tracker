#!/usr/bin/env python3
"""Garmin Connect import: steps, weigh-ins (body composition) and
activities, upserted into Supabase as source='garmin' rows.

Three ways this runs:
  - Nightly, in the cloud (GitHub Actions, .github/workflows/garmin-nightly.yml):
    `--yesterday` — the previous day only, once it's had all night to finish
    syncing from the watch/scale to Garmin's servers. Does not depend on
    this Mac being on at all.
  - On demand, from the app's "Refresh" button (app/api/garmin/refresh/route.ts):
    `--days 1` — today only, whenever the button is clicked.
  - By hand, for a backfill: `--days N` for any other trailing window.

Idempotent by design, not by convention: schema.sql's own comment says
"(user_id, source, external_id) unique indexes make future Garmin / Apple
imports idempotent" — weigh_ins_source_uidx and activities_source_uidx
exist for exactly this script, and daily_metrics' primary key
(user_id, local_date, metric) does the same job for steps. Re-running this
script for a day it already imported just overwrites with the same values.

Garmin login session: cached tokens are pulled from and pushed back to the
garmin_token_cache table (service-role only, see supabase/schema.sql)
before and after every run, not just read from the local
~/.garminconnect file — so a login made once, by hand, on this Mac
(login_check.py) is also usable by the nightly GitHub Actions job, which
has no local disk to persist a token on between runs. Whichever
environment refreshes the token first "wins"; the other picks up the
refreshed one on its next run.

This script never prompts for a Garmin password itself — it is meant to
run unattended, and a login prompt would just hang forever with no one
there to answer it. Run login_check.py by hand first if there's no valid
session yet.

Config: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_ID,
read from ../../.env.seed.local locally (the same file scripts/seed-demo.ts
reads) or from the real environment in CI (see the GitHub Actions workflow).

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
from supabase import Client, create_client

GRAMS_PER_LB = 453.59237
DEFAULT_DAYS = 7
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / ".env.seed.local"
TOKEN_DIR = Path("~/.garminconnect").expanduser()
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"

# Garmin's own activity typeKeys -> this app's activity_types.key (run / lift
# / walk / ride / swim / other). Snapshot taken from a real account's
# get_activity_types() (154 keys, Sept 2026) — anything Garmin adds later
# that isn't in this explicit map falls through to the keyword heuristic in
# classify_activity_type(), then to "other", with a printed note either way
# so a new/surprising typeKey is never silently misfiled.
EXPLICIT_TYPE_MAP = {
    "running": "run", "trail_running": "run", "street_running": "run",
    "track_running": "run", "treadmill_running": "run", "indoor_running": "run",
    "virtual_run": "run", "obstacle_run": "run",
    "walking": "walk", "casual_walking": "walk", "speed_walking": "walk",
    "hiking": "walk", "mountaineering": "walk",
    "cycling": "ride", "road_biking": "ride", "mountain_biking": "ride",
    "cyclocross": "ride", "downhill_biking": "ride", "track_cycling": "ride",
    "recumbent_cycling": "ride", "indoor_cycling": "ride", "virtual_ride": "ride",
    "gravel_cycling": "ride", "bmx": "ride", "e_bike_mountain": "ride",
    "e_bike_fitness": "ride",
    "swimming": "swim", "lap_swimming": "swim", "open_water_swimming": "swim",
    "strength_training": "lift", "indoor_cardio": "lift", "elliptical": "lift",
    "stair_climbing": "lift", "indoor_rowing": "lift", "pilates": "lift",
    "yoga": "lift", "hiit": "lift", "indoor_climbing": "lift", "bouldering": "lift",
}


def classify_activity_type(garmin_type_key: str) -> str:
    if garmin_type_key in EXPLICIT_TYPE_MAP:
        return EXPLICIT_TYPE_MAP[garmin_type_key]
    key = garmin_type_key.lower()
    guess = None
    if "run" in key:
        guess = "run"
    elif "walk" in key or "hik" in key:
        guess = "walk"
    elif "cycl" in key or "bik" in key or "ride" in key:
        guess = "ride"
    elif "swim" in key:
        guess = "swim"
    elif "strength" in key or "weight" in key or "lift" in key:
        guess = "lift"
    result = guess or "other"
    print(f"  note: Garmin activity type '{garmin_type_key}' isn't in the explicit map, guessed '{result}'")
    return result


REQUIRED_CONFIG = ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SEED_USER_ID")


def load_config() -> dict[str, str]:
    # Locally, .env.seed.local (gitignored) has these. In CI there is no such file — the
    # GitHub Actions workflow injects the same three as real environment variables instead,
    # from repo secrets. Either source works the same way from here on.
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


def pull_token_from_supabase(supabase: Client) -> None:
    """Before login: if there's no local token file yet (a fresh GitHub Actions runner,
    every time — it has no persistent disk between runs), restore the last-known-good one
    from garmin_token_cache. A Mac that already has a local token keeps using it as-is,
    rather than risking clobbering a fresher local session with a stale remote one."""
    if TOKEN_FILE.exists():
        return
    try:
        row = supabase.table("garmin_token_cache").select("tokens").eq("id", 1).maybe_single().execute()
    except Exception as err:  # noqa: BLE001 - fall through to login_check.py's own clear error
        print(f"  note: could not read garmin_token_cache ({err}); continuing without it")
        return
    if not row or not row.data:
        return
    TOKEN_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    TOKEN_FILE.write_text(json.dumps(row.data["tokens"]))
    TOKEN_FILE.chmod(0o600)
    print(f"  restored a cached Garmin session from Supabase to {TOKEN_FILE}")


def push_token_to_supabase(supabase: Client) -> None:
    """After a successful login (garminconnect may have just refreshed the token), save it
    back to garmin_token_cache so the next run — local or in CI — has the latest one."""
    if not TOKEN_FILE.exists():
        return
    tokens = json.loads(TOKEN_FILE.read_text())
    supabase.table("garmin_token_cache").upsert({"id": 1, "tokens": tokens}).execute()


def login_garmin(supabase: Client) -> Garmin:
    pull_token_from_supabase(supabase)
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
    push_token_to_supabase(supabase)
    return client


def fetch_window(garmin: Garmin, start: date, end: date) -> tuple[list, dict, list]:
    steps = garmin.get_daily_steps(start.isoformat(), end.isoformat())
    body = garmin.get_body_composition(start.isoformat(), end.isoformat())
    activities = garmin.get_activities_by_date(start.isoformat(), end.isoformat())
    return steps, body, activities


def build_steps_rows(user_id: str, steps: list) -> list[dict]:
    rows = []
    for day in steps:
        total = day.get("totalSteps")
        if total is None:
            continue
        rows.append({
            "user_id": user_id,
            "local_date": day["calendarDate"],
            "metric": "steps",
            "value": total,
            "source": "garmin",
        })
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
    for act in activities:
        garmin_type = act.get("activityType", {}).get("typeKey", "other")
        duration = act.get("duration")
        # activities.duration_min has a `> 0` check — a real but very short recording (a
        # GPS-glitch "activity" under 30s, seen live on this account) rounds to 0 and would
        # otherwise violate it, so the floor is 1 minute rather than the true rounded value.
        duration_min = max(1, round(duration / 60)) if duration else None
        rows.append({
            "user_id": user_id,
            "local_date": act["startTimeLocal"].split(" ")[0],
            "activity_type": classify_activity_type(garmin_type),
            "duration_min": duration_min,
            "notes": act.get("activityName"),
            "source": "garmin",
            "external_id": str(act["activityId"]),
        })
    return rows


BATCH_SIZE = 200


def _preview(table: str, rows: list[dict]) -> None:
    print(f"  {table}: would write {len(rows)} row(s) (dry run)")
    for row in rows[:3]:
        print(f"    {row}")
    if len(rows) > 3:
        print(f"    ... and {len(rows) - 3} more")


def upsert(supabase: Client, table: str, rows: list[dict], on_conflict: str, dry_run: bool) -> None:
    """For a table whose upsert target is a real (non-partial) unique index or primary
    key — daily_metrics' (user_id, local_date, metric) — PostgREST's on_conflict param
    works directly."""
    if not rows:
        print(f"  {table}: nothing to write")
        return
    if dry_run:
        _preview(table, rows)
        return
    written = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        result = supabase.table(table).upsert(batch, on_conflict=on_conflict).execute()
        written += len(result.data)
    print(f"  {table}: upserted {written} row(s)")


def upsert_by_external_id(supabase: Client, table: str, user_id: str, rows: list[dict], dry_run: bool) -> None:
    """weigh_ins_source_uidx and activities_source_uidx are PARTIAL unique indexes
    (`where external_id is not null`, so a plain manual entry with no external_id never
    collides with another). Postgres's ON CONFLICT can only infer a partial index when the
    same WHERE clause is repeated in the conflict clause itself — something PostgREST's
    on_conflict= parameter has no way to express — so this does the equivalent by hand:
    look up which external_ids already exist for this source, insert the new ones, update
    the rest by their real row id.
    """
    if not rows:
        print(f"  {table}: nothing to write")
        return
    if dry_run:
        _preview(table, rows)
        return

    existing_by_external_id: dict[str, str] = {}
    external_ids = [r["external_id"] for r in rows]
    for i in range(0, len(external_ids), BATCH_SIZE):
        chunk = external_ids[i : i + BATCH_SIZE]
        found = (
            supabase.table(table)
            .select("id,external_id")
            .eq("user_id", user_id)
            .eq("source", "garmin")
            .in_("external_id", chunk)
            .execute()
            .data
        )
        existing_by_external_id.update({row["external_id"]: row["id"] for row in found})

    inserts = [r for r in rows if r["external_id"] not in existing_by_external_id]
    updates = [r for r in rows if r["external_id"] in existing_by_external_id]

    for i in range(0, len(inserts), BATCH_SIZE):
        supabase.table(table).insert(inserts[i : i + BATCH_SIZE]).execute()
    for row in updates:
        row_id = existing_by_external_id[row["external_id"]]
        supabase.table(table).update({k: v for k, v in row.items() if k != "external_id"}).eq("id", row_id).execute()

    print(f"  {table}: inserted {len(inserts)}, updated {len(updates)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"trailing days to re-pull, ending today (default {DEFAULT_DAYS})")
    parser.add_argument("--yesterday", action="store_true", help="just yesterday — the nightly job's own window, distinct from --days")
    parser.add_argument("--dry-run", action="store_true", help="fetch and map, but write nothing to Supabase")
    args = parser.parse_args()

    config = load_config()
    user_id = config["SEED_USER_ID"]
    supabase = create_client(config["NEXT_PUBLIC_SUPABASE_URL"], config["SUPABASE_SERVICE_ROLE_KEY"])

    profile = supabase.table("profiles").select("timezone,display_name").eq("id", user_id).single().execute().data
    today = datetime.now(ZoneInfo(profile["timezone"])).date()
    if args.yesterday:
        start = end = today - timedelta(days=1)
    else:
        start, end = today - timedelta(days=args.days - 1), today

    print(f"Account: {profile['display_name']} ({user_id})")
    print(f"Window: {start.isoformat()} .. {end.isoformat()} (tz {profile['timezone']})")
    if args.dry_run:
        print("DRY RUN — nothing will be written to Supabase.\n")

    garmin = login_garmin(supabase)
    steps, body, activities = fetch_window(garmin, start, end)

    print(f"\nFetched from Garmin: {len(steps)} step-day(s), {len(body.get('dateWeightList', []))} weigh-in(s), {len(activities)} activit(y/ies)")

    upsert(supabase, "daily_metrics", build_steps_rows(user_id, steps), "user_id,local_date,metric", args.dry_run)
    upsert_by_external_id(supabase, "weigh_ins", user_id, build_weighin_rows(user_id, body), args.dry_run)
    upsert_by_external_id(supabase, "activities", user_id, build_activity_rows(user_id, activities), args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
