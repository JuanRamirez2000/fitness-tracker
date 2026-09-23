#!/usr/bin/env python3
"""Nightly Garmin Connect import: steps, weigh-ins (body composition) and
activities, upserted into Supabase as source='garmin' rows.

Idempotent by design, not by convention: schema.sql's own comment says
"(user_id, source, external_id) unique indexes make future Garmin / Apple
imports idempotent" — weigh_ins_source_uidx and activities_source_uidx
exist for exactly this script, and daily_metrics' primary key
(user_id, local_date, metric) does the same job for steps. Re-running this
script for a day it already imported just overwrites with the same values.

Every run re-pulls a trailing window (7 days by default) rather than only
"since last run", because Garmin's own data can sync late — a scale
reading or a watch activity uploaded a day or two after the fact would
otherwise be silently missed by a script that only looked at yesterday.

Requires:
  - A cached Garmin login: run login_check.py once, interactively, first.
    This script never prompts for a Garmin password — it is meant to run
    unattended (nightly via launchd/cron), and a login prompt would just
    hang forever with no one there to answer it.
  - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_ID in
    ../../.env.seed.local (the same file scripts/seed-demo.ts reads — one
    place for these dev-script secrets, never duplicated).

Usage:
    source .venv/bin/activate
    python import_garmin.py                # last 7 days, real write
    python import_garmin.py --days 365      # one-off historical backfill
    python import_garmin.py --dry-run       # fetch + map, print, write nothing
"""

import argparse
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
TOKEN_STORE = str(Path("~/.garminconnect").expanduser())

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


def load_config() -> dict[str, str]:
    if not ENV_FILE.exists():
        sys.exit(f"Missing {ENV_FILE}. Copy the Supabase URL/service key/SEED_USER_ID scripts/seed-demo.ts already uses.")
    values = dotenv_values(ENV_FILE)
    missing = [k for k in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SEED_USER_ID") if not values.get(k)]
    if missing:
        sys.exit(f"{ENV_FILE} is missing: {', '.join(missing)}")
    return values


def login_garmin() -> Garmin:
    try:
        client = Garmin()
        client.login(TOKEN_STORE)
        return client
    except GarminConnectTooManyRequestsError as err:
        sys.exit(f"Garmin rate-limited this request: {err}")
    except (GarminConnectAuthenticationError, GarminConnectConnectionError):
        sys.exit(
            "No valid cached Garmin login found. Run this first, in your own terminal:\n"
            "  source .venv/bin/activate && python login_check.py"
        )


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
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"trailing days to re-pull (default {DEFAULT_DAYS})")
    parser.add_argument("--dry-run", action="store_true", help="fetch and map, but write nothing to Supabase")
    args = parser.parse_args()

    config = load_config()
    user_id = config["SEED_USER_ID"]
    supabase = create_client(config["NEXT_PUBLIC_SUPABASE_URL"], config["SUPABASE_SERVICE_ROLE_KEY"])

    profile = supabase.table("profiles").select("timezone,display_name").eq("id", user_id).single().execute().data
    today = datetime.now(ZoneInfo(profile["timezone"])).date()
    start = today - timedelta(days=args.days - 1)

    print(f"Account: {profile['display_name']} ({user_id})")
    print(f"Window: {start.isoformat()} .. {today.isoformat()} ({args.days} day(s), tz {profile['timezone']})")
    if args.dry_run:
        print("DRY RUN — nothing will be written to Supabase.\n")

    garmin = login_garmin()
    steps, body, activities = fetch_window(garmin, start, today)

    print(f"\nFetched from Garmin: {len(steps)} step-day(s), {len(body.get('dateWeightList', []))} weigh-in(s), {len(activities)} activit(y/ies)")

    upsert(supabase, "daily_metrics", build_steps_rows(user_id, steps), "user_id,local_date,metric", args.dry_run)
    upsert_by_external_id(supabase, "weigh_ins", user_id, build_weighin_rows(user_id, body), args.dry_run)
    upsert_by_external_id(supabase, "activities", user_id, build_activity_rows(user_id, activities), args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
