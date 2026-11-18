#!/usr/bin/env python3
"""Garmin import, unofficial half: the fields Garmin's official Personal API doesn't serve
(docs/garmin-fields.md). Everything else is imported by lib/garmin/ (TypeScript).

Datasets:
  readiness  training readiness: the day's latest snapshot (score, level, six factors,
             recovery time) plus the morning score -> daily_recovery's readiness columns.
  training   training status: acute and chronic load, the optimal chronic band, ACWR,
             status, load focus with its targets, and VO2 max -> daily_training.
  race       race predictions: 5K, 10K, half and full marathon seconds per day -> daily_training.
  vo2        VO2 max on each day Garmin updated it (max metrics, cheap for long
             backfills), running and cycling -> daily_training.vo2max, vo2max_cycling.
  ftp        the cycling FTP set in Garmin, on each day it changed -> daily_training.ftp_w.
  plan       planned sessions: a Garmin Coach plan's tasks (name, workout, estimated time,
             benefit, rest days) plus every other workout on the Garmin calendar, read with its
             detail (the app that sent it, e.g. Runna; its text; a time from its steps), from a week
             back to about two months ahead -> planned_workouts (future Garmin rows replaced;
             the tracker's own workouts, source = 'self', are left alone: push_workout.py).

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
import re
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
DATASETS = ("readiness", "training", "race", "vo2", "ftp", "plan")
# Garmin Coach plan statuses still worth importing.
LIVE_PLAN_STATUSES = {"Scheduled", "Active", "InProgress", "In_Progress"}
# Calendar item types that are planned sessions (not done activities, badges or plan banners).
PLANNED_ITEM_TYPES = {"fbtAdaptiveWorkout", "workout"}
PLAN_LOOKBACK_DAYS = 7
# Plan apps put the plan week and weekday first: Runna's "W1 Wed Easy Run - 3mi Easy Run (3mi)".
WEEK_PREFIX = re.compile(r"^W\d+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+")
# "Kind - detail" after that prefix; "#2" on a repeated kind is dropped.
KIND_DETAIL = re.compile(r"^(?P<kind>.+?)\s+-\s+(?P<detail>.+)$")
COACH_PROVIDER = "Garmin Coach"
# Session names that mark the week's hard or long sessions, and the easy ones (checked first).
EASY_KINDS = re.compile(r"easy|recovery|shake ?out|base|endurance|skills|technique|drill", re.IGNORECASE)
KEY_KINDS = re.compile(r"long|tempo|interval|threshold|vo2|hill|fartlek|progress|race|speed|sweet ?spot|anaerobic|repeat|drop set|time trial", re.IGNORECASE)
# A distance in a title or a step's text: "(3mi)", "0.75mi warm up", "400 yd", "5 km".
DISTANCE = re.compile(r"(?P<n>\d+(?:\.\d+)?)\s*(?P<unit>mi|km|m|yd)\b", re.IGNORECASE)
METERS = {"mi": 1609.344, "km": 1000.0, "m": 1.0, "yd": 0.9144}
# Workout targets given as a speed range (m/s), so a distance step's time can be worked out.
SPEED_TARGETS = {"pace.zone", "speed.zone"}
# Seconds per meter for each sport when there are no recent sessions to go by.
DEFAULT_PACES = {"run": 12 * 60 / 1609.344, "ride": 3600 / (15 * 1609.344), "swim": 3.0 / 0.9144}
# A planned session at least this long counts as a key (long) one when its name doesn't say.
LONG_SESSION_S = 75 * 60
PAUSE_PER_WORKOUT_S = 0.3
# Days per request for the range endpoints (race predictions allow up to a year).
RANGE_CHUNK_DAYS = 90
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


FOCUS_FIELDS = {
    "aerobic_low": "monthlyLoadAerobicLow",
    "aerobic_high": "monthlyLoadAerobicHigh",
    "anaerobic": "monthlyLoadAnaerobic",
}


def _primary(device_map: dict[str, Any] | None) -> dict[str, Any] | None:
    """Training status keys its data by device ID; take the primary training device's."""
    if not device_map:
        return None
    entries = [v for v in device_map.values() if isinstance(v, dict)]
    return next((e for e in entries if e.get("primaryTrainingDevice")), entries[0] if entries else None)


def _status_word(phrase: str | None) -> str | None:
    """"PRODUCTIVE_3" -> "PRODUCTIVE"; Garmin appends a feedback variant number."""
    if not phrase:
        return None
    head, _, tail = phrase.rpartition("_")
    return head if tail.isdigit() and head else phrase


def training_row(payload: dict[str, Any] | None, day: str) -> dict[str, Any] | None:
    """daily_training's unofficial columns for `day` from get_training_status(day). Each part
    is kept only when Garmin dated it `day`, so a day without its own update stays empty
    rather than repeating an older value."""
    if not payload:
        return None
    row: dict[str, Any] = {"local_date": day}

    status = _primary((payload.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData"))
    if status and status.get("calendarDate") == day:
        load = status.get("acuteTrainingLoadDTO") or {}
        row.update({
            "acute_load": load.get("dailyTrainingLoadAcute"),
            "chronic_load": load.get("dailyTrainingLoadChronic"),
            "chronic_low": load.get("minTrainingLoadChronic"),
            "chronic_high": load.get("maxTrainingLoadChronic"),
            "acwr": load.get("dailyAcuteChronicWorkloadRatio"),
            "status": _status_word(status.get("trainingStatusFeedbackPhrase")),
        })

    balance = _primary((payload.get("mostRecentTrainingLoadBalance") or {}).get("metricsTrainingLoadBalanceDTOMap"))
    if balance and balance.get("calendarDate") == day:
        row["focus"] = {
            key: {
                "value": balance.get(field),
                "low": balance.get(f"{field}TargetMin"),
                "high": balance.get(f"{field}TargetMax"),
            }
            for key, field in FOCUS_FIELDS.items()
        }
        row["focus_feedback"] = balance.get("trainingBalanceFeedbackPhrase")

    vo2 = ((payload.get("mostRecentVO2Max") or {}).get("generic")) or {}
    if vo2.get("calendarDate") == day and vo2.get("vo2MaxPreciseValue") is not None:
        row["vo2max"] = vo2["vo2MaxPreciseValue"]
    cycling = ((payload.get("mostRecentVO2Max") or {}).get("cycling")) or {}
    if cycling.get("calendarDate") == day and cycling.get("vo2MaxPreciseValue") is not None:
        row["vo2max_cycling"] = cycling["vo2MaxPreciseValue"]

    return row if len(row) > 1 else None


def race_rows(payload: list[dict[str, Any]] | dict[str, Any] | None) -> list[dict[str, Any]]:
    """daily_training's race columns from get_race_predictions(start, end, "daily")."""
    if not payload:
        return []
    entries = payload if isinstance(payload, list) else [payload]
    rows = []
    for e in entries:
        if not e.get("calendarDate") or e.get("time5K") is None:
            continue
        rows.append({
            "local_date": e["calendarDate"],
            "race_5k_s": e.get("time5K"),
            "race_10k_s": e.get("time10K"),
            "race_half_s": e.get("timeHalfMarathon"),
            "race_marathon_s": e.get("timeMarathon"),
        })
    return rows


def vo2_rows(payload: list[dict[str, Any]] | dict[str, Any] | None) -> list[dict[str, Any]]:
    """daily_training.vo2max (running) and vo2max_cycling for each day get_max_metrics_range
    lists (days with an update), one row per day."""
    if not payload:
        return []
    entries = payload if isinstance(payload, list) else [payload]
    by_day: dict[str, dict[str, Any]] = {}
    for e in entries:
        for key, column in (("generic", "vo2max"), ("cycling", "vo2max_cycling")):
            part = e.get(key) or {}
            if part.get("calendarDate") and part.get("vo2MaxPreciseValue") is not None:
                day = part["calendarDate"]
                by_day.setdefault(day, {"local_date": day})[column] = part["vo2MaxPreciseValue"]
    return [by_day[d] for d in sorted(by_day)]


def ftp_rows(payload: list[dict[str, Any]] | dict[str, Any] | None, today: str) -> list[dict[str, Any]]:
    """daily_training.ftp_w from Garmin's FTP endpoints. Their shape isn't documented, so this
    accepts both seen in Garmin's biometric responses: the latest-value record (calendarDate,
    functionalThresholdPower) and the range series (from, value). An entry without a date is
    today's (the latest value, as of this run)."""
    if not payload:
        return []
    entries = payload if isinstance(payload, list) else [payload]
    by_day: dict[str, int] = {}
    for e in entries:
        if not isinstance(e, dict):
            continue
        watts = e.get("functionalThresholdPower", e.get("value"))
        if not isinstance(watts, (int, float)) or watts <= 0:
            continue
        day = str(e.get("calendarDate") or e.get("from") or e.get("date") or today)[:10]
        by_day[day] = round(watts)
    return [{"local_date": d, "ftp_w": by_day[d]} for d in sorted(by_day)]


def tracker_sport(sport_key: str | None) -> str | None:
    """Garmin's sportTypeKey -> run | ride | swim (the tracker's sports), or None."""
    k = (sport_key or "").lower()
    if k.endswith("running") or k == "running":
        return "run"
    if "cycl" in k or "bik" in k or k.endswith("_ride"):
        return "ride"
    if "swim" in k:
        return "swim"
    return None


def first_distance_m(text: str | None) -> float | None:
    m = DISTANCE.search(text or "")
    return float(m["n"]) * METERS[m["unit"].lower()] if m else None


def clean_name(title: str | None) -> tuple[str | None, str | None]:
    """A calendar title -> (name, detail): the plan week prefix dropped and "Kind - detail" split,
    so "W1 Wed Easy Run #2 - 3mi Easy Run (3mi)" is ("Easy Run", "3mi Easy Run (3mi)")."""
    if not title:
        return None, None
    rest = WEEK_PREFIX.sub("", title).strip()
    m = KIND_DETAIL.match(rest) if rest != title.strip() else None
    if not m:
        return rest, None
    return re.sub(r"\s*#\d+$", "", m["kind"]).strip(), m["detail"].strip()


def step_seconds(step: dict[str, Any], pace: float) -> float | None:
    """One workout step's time: as given for a time step; for a distance step, at the middle of
    its speed target, else at `pace` (s/m); a lap-button step by the distance in its text. None
    when it can't be told (an open-ended step with no distance)."""
    if step.get("type") == "RepeatGroupDTO" or step.get("workoutSteps"):
        inner = [step_seconds(x, pace) for x in step.get("workoutSteps") or []]
        if not inner or any(t is None for t in inner):
            return None
        return (step.get("numberOfIterations") or 1) * sum(inner)
    cond = ((step.get("endCondition") or {}).get("conditionTypeKey")) or ""
    value = step.get("endConditionValue")
    if cond == "time" and value:
        return float(value)
    meters = float(value) if cond == "distance" and value else first_distance_m(step.get("description"))
    if not meters:
        return None
    target = ((step.get("targetType") or {}).get("workoutTargetTypeKey")) or ""
    lo, hi = step.get("targetValueOne"), step.get("targetValueTwo")
    if target in SPEED_TARGETS and lo and hi:
        return meters / ((float(lo) + float(hi)) / 2)
    return meters * pace


def workout_seconds(detail: dict[str, Any], pace: float) -> float | None:
    """A whole workout's time from its steps, or None when any step's time can't be told."""
    steps = [x for seg in detail.get("workoutSegments") or [] for x in seg.get("workoutSteps") or []]
    times = [step_seconds(x, pace) for x in steps]
    return sum(times) if times and all(t is not None for t in times) else None  # type: ignore[arg-type]


def is_key(name: str | None, detail: dict[str, Any] | None, seconds: float | None) -> bool:
    """A hard or long session: by its name first (easy names never are), then by its structure
    (two or more targeted work steps), then by length."""
    if name and EASY_KINDS.search(name):
        return False
    if name and KEY_KINDS.search(name):
        return True
    def work_steps(steps: list[dict[str, Any]]) -> int:
        n = 0
        for x in steps:
            if x.get("type") == "RepeatGroupDTO" or x.get("workoutSteps"):
                n += (x.get("numberOfIterations") or 1) * work_steps(x.get("workoutSteps") or [])
            elif ((x.get("stepType") or {}).get("stepTypeKey")) == "interval" and ((x.get("targetType") or {}).get("workoutTargetTypeKey") or "no.target") != "no.target":
                n += 1
        return n

    work = sum(work_steps(seg.get("workoutSteps") or []) for seg in (detail or {}).get("workoutSegments") or [])
    return work >= 2 or (seconds or 0) >= LONG_SESSION_S


def plan_name_of(description: str | None, provider: str | None) -> str | None:
    """The plan a workout belongs to: its text's first line when that names one ("10k Plan
    (Week 1/12)" -> "10k Plan"), else the provider."""
    first = (description or "").strip().split("\n")[0].strip()
    if first and len(first) <= 60 and re.search(r"\bplan\b", first, re.IGNORECASE):
        return re.sub(r"\s*\(week[^)]*\)\s*$", "", first, flags=re.IGNORECASE).strip()
    return provider


def calendar_row(item: dict[str, Any], detail: dict[str, Any] | None, paces: dict[str, float]) -> dict[str, Any]:
    """One planned_workouts row from a calendar workout and, when it could be fetched, its detail:
    who planned it (the workout's provider app; None when made in Garmin Connect), the plan,
    the session text, a time (Garmin's, else worked out from the steps or the distance), and
    whether it's a key session."""
    title = item.get("title") or (detail or {}).get("workoutName")
    name, title_detail = clean_name(title)
    sport_key = item.get("sportTypeKey") or ((detail or {}).get("sportType") or {}).get("sportTypeKey")
    pace = paces.get(tracker_sport(sport_key) or "", DEFAULT_PACES["run"])
    provider = (detail or {}).get("workoutProvider") or (detail or {}).get("consumerName") or None
    text = ((detail or {}).get("description") or "").strip() or None

    duration: float | None = float(item["duration"]) if item.get("duration") else None
    if duration is None and detail and detail.get("estimatedDurationInSecs"):
        duration = float(detail["estimatedDurationInSecs"])
    desc = text or title_detail
    estimated = False
    if duration is None:
        worked = workout_seconds(detail, pace) if detail else None
        if worked is None:
            meters = first_distance_m(title_detail or title)
            worked = meters * pace if meters else None
        duration, estimated = worked, worked is not None
    return {
        "workout_uuid": item.get("workoutUuid") or f"workout-{item['workoutId']}-{item['date']}",
        "local_date": item["date"],
        "sport": sport_key,
        "name": name,
        "description": desc[:800] if desc else None,
        "duration_s": round(duration) if duration else None,
        "benefit": None,
        "rest_day": False,
        "key_workout": is_key(name, detail, duration),
        "status": None,
        "plan_name": plan_name_of(text, provider),
        "provider": provider,
        "duration_estimated": estimated,
    }


def plan_rows(
    plan: dict[str, Any] | None,
    calendar_items: list[dict[str, Any]],
    earliest: str,
    own_workout_ids: set[int] | frozenset[int] = frozenset(),
    details: dict[int, dict[str, Any]] | None = None,
    paces: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """planned_workouts rows from an adaptive Coach plan (its taskList carries the detail: the
    workout shorthand, estimated time, benefit, rest days) and every other planned workout on the
    Garmin calendar, whichever app put it there (Runna, TrainingPeaks...) or made in Garmin
    Connect, read with its workout detail (`details`, by workoutId) where available. The Coach
    plan's version of a session wins; days before `earliest` are dropped, and so are calendar
    items for the tracker's own workouts (`own_workout_ids`), which already have a richer row."""
    rows: dict[str, dict[str, Any]] = {}
    details = details or {}
    paces = {**DEFAULT_PACES, **(paces or {})}
    plan_name = (plan or {}).get("name")
    for task in (plan or {}).get("taskList") or []:
        workout = task.get("taskWorkout") or {}
        uuid, day = workout.get("workoutUuid"), task.get("calendarDate")
        if not uuid or not day or day < earliest:
            continue
        label = workout.get("trainingEffectLabel")
        rows[uuid] = {
            "workout_uuid": uuid,
            "local_date": day,
            "sport": (workout.get("sportType") or {}).get("sportTypeKey"),
            "name": workout.get("workoutName"),
            "description": workout.get("workoutDescription"),
            "duration_s": workout.get("estimatedDurationInSecs"),
            "benefit": None if label in (None, "INVALID") else label,
            "rest_day": bool(workout.get("restDay")),
            "key_workout": bool(task.get("keyWorkout")),
            "status": workout.get("adaptiveCoachingWorkoutStatus"),
            "plan_name": plan_name,
            "provider": COACH_PROVIDER,
            "duration_estimated": False,
        }
    for item in calendar_items:
        if item.get("itemType") not in PLANNED_ITEM_TYPES or not item.get("date") or item["date"] < earliest:
            continue
        if item.get("workoutId") in own_workout_ids:
            continue
        if not item.get("workoutUuid") and not item.get("workoutId"):
            continue
        row = calendar_row(item, details.get(item.get("workoutId")), paces)
        if row["workout_uuid"] in rows:
            continue
        if item.get("itemType") == "fbtAdaptiveWorkout":
            # A Coach session beyond the week the plan's taskList covers.
            row.update(plan_name=plan_name, provider=COACH_PROVIDER)
        rows[row["workout_uuid"]] = row
    return sorted(rows.values(), key=lambda r: (r["local_date"], r["workout_uuid"]))


def chunks(start: date, end: date, days: int):
    """start..end as consecutive (first, last) windows of at most `days` days."""
    first = start
    while first <= end:
        last = min(first + timedelta(days=days - 1), end)
        yield first, last
        first = last + timedelta(days=1)


TRAINING_COLUMNS = (
    "acute_load", "chronic_load", "chronic_low", "chronic_high", "acwr", "status",
    "focus", "focus_feedback", "vo2max", "race_5k_s", "race_10k_s", "race_half_s",
    "race_marathon_s", "vo2max_cycling", "ftp_w",
)


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


def upsert_training(conn, user_id: str, rows: list[dict[str, Any]], dry_run: bool, label: str = "training") -> None:
    if not rows:
        print(f"  {label}: nothing to write")
        return
    if dry_run:
        print(f"  {label}: would write {len(rows)} row(s) (dry run)")
        for row in rows[-3:]:
            print(f"    {row}")
        return
    from psycopg.types.json import Jsonb

    with conn.cursor() as cur:
        for row in rows:
            # Only the parts Garmin dated this day: a missing part keeps what the row had.
            cols = [c for c in TRAINING_COLUMNS if c in row]
            values = {c: Jsonb(row[c]) if c == "focus" else row[c] for c in cols}
            cur.execute(
                f"""insert into daily_training (user_id, local_date, {", ".join(cols)})
                    values (%(user_id)s, %(local_date)s, {", ".join(f"%({c})s" for c in cols)})
                    on conflict (user_id, local_date) do update set
                      {", ".join(f"{c} = excluded.{c}" for c in cols)}, updated_at = now()""",
                {**values, "user_id": user_id, "local_date": row["local_date"]},
            )
    conn.commit()
    print(f"  {label}: upserted {len(rows)} row(s)")


PLAN_COLUMNS = (
    "local_date", "sport", "name", "description", "duration_s", "benefit", "rest_day", "key_workout", "status", "plan_name",
    "provider", "duration_estimated",
)


def replace_plan(conn, user_id: str, rows: list[dict[str, Any]], today: str, dry_run: bool) -> None:
    """Today's and later planned rows are replaced wholesale (an adaptive plan reshuffles and
    drops sessions); earlier ones are upserted, so a session's status can still change."""
    if dry_run:
        print(f"  plan: would replace planned sessions from {today} with {len(rows)} row(s) (dry run)")
        for row in rows[:8]:
            print(f"    {row}")
        return
    with conn.cursor() as cur:
        cur.execute(
            "delete from planned_workouts where user_id = %s and local_date >= %s and source = 'garmin'",
            (user_id, today),
        )
        for row in rows:
            cur.execute(
                f"""insert into planned_workouts (user_id, workout_uuid, {", ".join(PLAN_COLUMNS)})
                    values (%(user_id)s, %(workout_uuid)s, {", ".join(f"%({c})s" for c in PLAN_COLUMNS)})
                    on conflict (user_id, workout_uuid) do update set
                      {", ".join(f"{c} = excluded.{c}" for c in PLAN_COLUMNS)}, updated_at = now()""",
                {**row, "user_id": user_id},
            )
    conn.commit()
    print(f"  plan: wrote {len(rows)} planned session(s)")


def own_workout_ids(conn, user_id: str) -> set[int]:
    """Garmin workout ids of the tracker's own workouts (push_workout.py), so the calendar copy
    of one isn't imported a second time."""
    rows = conn.execute(
        "select garmin_workout_id from planned_workouts where user_id = %s and source = 'self' and garmin_workout_id is not null",
        (user_id,),
    ).fetchall()
    return {int(r[0]) for r in rows}


def recent_paces(conn, user_id: str, today: date) -> dict[str, float]:
    """Seconds per meter for each sport over the last 60 days, for distance-only planned steps."""
    rows = conn.execute(
        """select case when activity_type like '%%running' then 'run'
                       when activity_type like '%%swimming' then 'swim'
                       when activity_type like '%%cycling' or activity_type like '%%biking' or activity_type like '%%ride' then 'ride' end as sport,
                  sum(coalesce(moving_duration_s, duration_s)), sum(distance_m)
           from activities where user_id = %s and distance_m > 0 and local_date >= %s
           group by 1""",
        (user_id, (today - timedelta(days=60)).isoformat()),
    ).fetchall()
    return {sport: float(secs) / float(meters) for sport, secs, meters in rows if sport and secs and meters}


def fetch_plan(garmin, today: date, own_ids: set[int], paces: dict[str, float] | None = None) -> list[dict[str, Any]]:
    """The live Coach plan (if any), three months of the Garmin calendar, and the detail of each
    calendar workout ahead (who sent it, its text and steps). A detail that fails to load leaves
    that workout with its calendar title only."""
    plan = None
    listing = garmin.get_training_plans() or {}
    for p in listing.get("trainingPlanList") or []:
        status = (p.get("trainingStatus") or {}).get("statusKey")
        if p.get("trainingPlanCategory") == "FBT_ADAPTIVE" and status in LIVE_PLAN_STATUSES:
            plan = garmin.get_adaptive_training_plan_by_id(p["trainingPlanId"])
            break
    items: list[dict[str, Any]] = []
    year, month = today.year, today.month
    for _ in range(3):
        cal = garmin.get_scheduled_workouts(year, month) or {}
        items += cal.get("calendarItems") or []
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        time.sleep(PER_DAY_PAUSE_S)
    earliest = (today - timedelta(days=PLAN_LOOKBACK_DAYS)).isoformat()
    details: dict[int, dict[str, Any]] = {}
    for item in items:
        wid = item.get("workoutId")
        if item.get("itemType") != "workout" or not wid or wid in own_ids or wid in details or (item.get("date") or "") < today.isoformat():
            continue
        try:
            details[wid] = garmin.get_workout_by_id(wid) or {}
        except Exception as err:  # noqa: BLE001
            print(f"  plan: no detail for workout {wid} ({err})")
        time.sleep(PAUSE_PER_WORKOUT_S)
    return plan_rows(plan, items, earliest, own_ids, details, paces)


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

        if "training" in datasets:
            rows = []
            day = start
            while day <= end:
                row = training_row(garmin.get_training_status(day.isoformat()), day.isoformat())
                if row:
                    rows.append(row)
                day += timedelta(days=1)
                time.sleep(PER_DAY_PAUSE_S)
            print(f"Fetched training status for {len(rows)} day(s)")
            upsert_training(conn, user_id, rows, args.dry_run)

        if "race" in datasets:
            rows = []
            for first, last in chunks(start, end, RANGE_CHUNK_DAYS):
                rows += race_rows(garmin.get_race_predictions(first.isoformat(), last.isoformat(), "daily"))
                time.sleep(PER_DAY_PAUSE_S)
            print(f"Fetched race predictions for {len(rows)} day(s)")
            upsert_training(conn, user_id, rows, args.dry_run, "race")

        if "vo2" in datasets:
            rows = []
            for first, last in chunks(start, end, RANGE_CHUNK_DAYS):
                rows += vo2_rows(garmin.get_max_metrics_range(first.isoformat(), last.isoformat()))
                time.sleep(PER_DAY_PAUSE_S)
            print(f"Fetched VO2 max for {len(rows)} day(s)")
            upsert_training(conn, user_id, rows, args.dry_run, "vo2")

        if "ftp" in datasets:
            # Extra, never fatal: Garmin answers 404 until an FTP is set or detected.
            try:
                payload = garmin.get_functional_threshold_power_range(start.isoformat(), end.isoformat(), sport="CYCLING")
                rows = ftp_rows(payload, end.isoformat())
                if not rows:
                    rows = ftp_rows(garmin.get_cycling_ftp(), end.isoformat())
            except Exception as err:  # noqa: BLE001 — the library raises several types for a 404
                print(f"  ftp: skipped ({err})")
                rows = []
            print(f"Fetched cycling FTP for {len(rows)} day(s)")
            upsert_training(conn, user_id, rows, args.dry_run, "ftp")

        if "plan" in datasets:
            # Extra, never fatal: a failed fetch leaves the planned sessions as they were.
            today = datetime.now(ZoneInfo(tz)).date()
            try:
                rows = fetch_plan(garmin, today, own_workout_ids(conn, user_id), recent_paces(conn, user_id, today))
            except Exception as err:  # noqa: BLE001
                print(f"  plan: skipped ({err})")
                rows = None
            if rows is not None:
                print(f"Fetched {len(rows)} planned session(s)")
                replace_plan(conn, user_id, rows, today.isoformat(), args.dry_run)

    print("Done.")


if __name__ == "__main__":
    main()
