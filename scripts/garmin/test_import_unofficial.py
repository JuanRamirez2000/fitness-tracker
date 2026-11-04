"""Tests for import_unofficial.py's pure mapping, against the real (anonymised) fixtures.

    scripts/garmin/.venv/bin/python -m unittest discover -s scripts/garmin
"""

import json
import unittest
from datetime import date
from pathlib import Path

from import_unofficial import readiness_row, window

FIXTURES = Path(__file__).resolve().parents[2] / "lib" / "garmin" / "fixtures" / "unofficial"


class ReadinessRowTest(unittest.TestCase):
    def test_takes_the_latest_snapshot_and_keeps_the_morning_score(self):
        snapshots = json.loads((FIXTURES / "training-readiness.json").read_text())
        row = readiness_row(snapshots)
        self.assertEqual(row["local_date"], "2026-11-02")
        # Nov 2: morning 68, after the run 58 (the latest, with 758 min of recovery left).
        self.assertEqual(row["readiness_score"], 58)
        self.assertEqual(row["readiness_morning_score"], 68)
        self.assertEqual(row["recovery_hours"], 12.6)
        self.assertEqual(set(row["readiness_factors"]), {"sleep_history", "hrv", "recovery_time", "acwr", "stress_history", "sleep"})
        self.assertTrue(row["readiness_at"].endswith("Z"))

    def test_empty_or_unscored_days_are_none(self):
        self.assertIsNone(readiness_row([]))
        self.assertIsNone(readiness_row(None))
        self.assertIsNone(readiness_row([{"calendarDate": "2026-11-02", "score": None}]))

    def test_accepts_a_single_snapshot_dict(self):
        row = readiness_row({"calendarDate": "2026-11-02", "score": 70, "timestamp": "2026-11-02T14:00:00.0"})
        self.assertEqual(row["readiness_score"], 70)
        self.assertIsNone(row["readiness_morning_score"])


class WindowTest(unittest.TestCase):
    def test_yesterday_also_takes_today(self):
        self.assertEqual(window(date(2026, 11, 3), 7, True, None), (date(2026, 11, 2), date(2026, 11, 3)))

    def test_days_and_since(self):
        self.assertEqual(window(date(2026, 11, 3), 7, False, None), (date(2026, 10, 28), date(2026, 11, 3)))
        self.assertEqual(window(date(2026, 11, 3), 7, False, date(2026, 9, 1)), (date(2026, 9, 1), date(2026, 11, 3)))


if __name__ == "__main__":
    unittest.main()
