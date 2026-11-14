#!/usr/bin/env python3
"""Send self-made workouts to the Garmin calendar, so they reach the watch on its next sync.

The workouts are built in TypeScript (lib/workouts/), by the "Plan a run" modal or the
`npm run workout:run` script, and saved to planned_workouts with source = 'self', the Garmin
workout JSON in `garmin_workout` and a `push_status`:

  queued    -> upload the workout, put it on the Garmin calendar on local_date -> sent
  removing  -> take it off the calendar, delete the workout, delete the row
  failed    -> the error is in push_error; re-queue to retry

Garmin's official API can't create workouts, so this uses the unofficial
cyberjunky/python-garminconnect login shared with import_unofficial.py (the session in
~/.garminconnect, mirrored to garmin_token_cache).

Usage:
    scripts/garmin/.venv/bin/python scripts/garmin/push_workout.py --pending       # every queued or removing row
    scripts/garmin/.venv/bin/python scripts/garmin/push_workout.py --id <uuid>     # one row
    scripts/garmin/.venv/bin/python scripts/garmin/push_workout.py --smoke-test    # upload, schedule, remove a throwaway

Scheduled: .github/workflows/garmin-push.yml runs --pending when the web app asks for it.
Config: DATABASE_URL from the environment, else the repo's .env.local (its LAST DATABASE_URL).
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from import_unofficial import database_url, login_garmin

SMOKE_TEST_DATE = "2027-12-31"


def schedule_id(response: Any) -> int | None:
    """Garmin's schedule response carries the calendar entry's id (needed to unschedule)."""
    if isinstance(response, dict):
        for key in ("workoutScheduleId", "scheduleId", "id"):
            value = response.get(key)
            if isinstance(value, int):
                return value
    return None


def push(garmin, workout: dict[str, Any], day: str) -> tuple[int, int | None]:
    """Upload a workout and schedule it on `day`. Returns (workout id, schedule id)."""
    created = garmin.upload_workout(workout)
    workout_id = created.get("workoutId") if isinstance(created, dict) else None
    if not isinstance(workout_id, int):
        raise RuntimeError(f"Garmin didn't return a workout id: {created!r}"[:300])
    try:
        scheduled = garmin.schedule_workout(workout_id, day)
    except Exception:
        # Don't leave an orphan in the workout library when the calendar step fails.
        garmin.delete_workout(workout_id)
        raise
    return workout_id, schedule_id(scheduled)


def remove(garmin, workout_id: int | None, sched_id: int | None) -> None:
    """Take a workout off the calendar and out of the library. Missing ids are skipped, and a
    404 (already removed in Garmin Connect) counts as done."""
    for step, value in (("unschedule", sched_id), ("delete", workout_id)):
        if not value:
            continue
        try:
            garmin.unschedule_workout(value) if step == "unschedule" else garmin.delete_workout(value)
        except Exception as err:  # noqa: BLE001 — the library raises several types for a 404
            if "404" not in str(err):
                raise


def process_row(conn, garmin, row: dict[str, Any]) -> None:
    uuid, status = row["workout_uuid"], row["push_status"]
    try:
        if status == "removing":
            remove(garmin, row["garmin_workout_id"], row["garmin_schedule_id"])
            conn.execute("delete from planned_workouts where user_id = %s and workout_uuid = %s", (row["user_id"], uuid))
            print(f"  removed {uuid} ({row['local_date']})")
        else:
            if row["garmin_workout_id"]:
                # A retry after a half-finished push: start clean.
                remove(garmin, row["garmin_workout_id"], row["garmin_schedule_id"])
            workout_id, sched_id = push(garmin, row["garmin_workout"], row["local_date"].isoformat())
            conn.execute(
                """update planned_workouts set push_status = 'sent', push_error = null, garmin_workout_id = %s,
                     garmin_schedule_id = %s, pushed_at = now(), updated_at = now()
                   where user_id = %s and workout_uuid = %s""",
                (workout_id, sched_id, row["user_id"], uuid),
            )
            print(f"  sent {uuid} -> workout {workout_id}, calendar {sched_id} on {row['local_date']}")
    except Exception as err:  # noqa: BLE001 — record any failure on the row, keep going
        conn.execute(
            """update planned_workouts set push_status = 'failed', push_error = %s, updated_at = now()
               where user_id = %s and workout_uuid = %s""",
            (str(err)[:500], row["user_id"], uuid),
        )
        print(f"  FAILED {uuid}: {err}")
    conn.commit()


def smoke_test(garmin) -> None:
    workout = {
        "workoutName": "Tracker smoke test (delete me)",
        "sportType": {"sportTypeId": 1, "sportTypeKey": "running", "displayOrder": 1},
        "estimatedDurationInSecs": 300,
        "workoutSegments": [{
            "segmentOrder": 1,
            "sportType": {"sportTypeId": 1, "sportTypeKey": "running", "displayOrder": 1},
            "workoutSteps": [{
                "type": "ExecutableStepDTO", "stepOrder": 1,
                "stepType": {"stepTypeId": 3, "stepTypeKey": "interval", "displayOrder": 3},
                "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time", "displayOrder": 2, "displayable": True},
                "endConditionValue": 300.0,
                "targetType": {"workoutTargetTypeId": 4, "workoutTargetTypeKey": "heart.rate.zone", "displayOrder": 4},
                "zoneNumber": 2,
            }],
        }],
    }
    workout_id, sched_id = push(garmin, workout, SMOKE_TEST_DATE)
    print(f"  uploaded workout {workout_id}, scheduled {sched_id} on {SMOKE_TEST_DATE}")
    stored = garmin.get_workout_by_id(workout_id)
    step = stored["workoutSegments"][0]["workoutSteps"][0]
    print(f"  Garmin stored the step as {step.get('targetType', {}).get('workoutTargetTypeKey')} zone {step.get('zoneNumber')}")
    remove(garmin, workout_id, sched_id)
    print("  removed it again")


ROW_COLUMNS = "user_id, workout_uuid, local_date, push_status, garmin_workout, garmin_workout_id, garmin_schedule_id"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pending", action="store_true", help="every queued or removing row")
    group.add_argument("--id", help="one row, by workout_uuid (queued, removing or failed)")
    group.add_argument("--smoke-test", action="store_true", help=f"upload, schedule on {SMOKE_TEST_DATE}, then remove a throwaway")
    args = parser.parse_args()

    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url(), prepare_threshold=None, row_factory=dict_row) as conn:
        if args.smoke_test:
            # The row factory only matters for the queue; login_garmin reads the token by index.
            conn.row_factory = psycopg.rows.tuple_row
            smoke_test(login_garmin(conn))
            print("Done.")
            return
        if args.id:
            rows = conn.execute(
                f"select {ROW_COLUMNS} from planned_workouts where source = 'self' and workout_uuid = %s",
                (args.id,),
            ).fetchall()
        else:
            rows = conn.execute(
                f"""select {ROW_COLUMNS} from planned_workouts
                    where source = 'self' and push_status in ('queued', 'removing') order by local_date""",
            ).fetchall()
        rows = [r for r in rows if r["push_status"] in ("queued", "removing", "failed")]
        if not rows:
            print("Nothing to send.")
            return
        print(f"{len(rows)} workout(s) to process")
        conn.row_factory = psycopg.rows.tuple_row
        garmin = login_garmin(conn)
        conn.row_factory = dict_row
        for row in rows:
            process_row(conn, garmin, row)
    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
