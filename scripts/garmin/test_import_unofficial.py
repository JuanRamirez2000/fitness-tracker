"""Tests for import_unofficial.py's pure mapping, against the real (anonymised) fixtures.

    scripts/garmin/.venv/bin/python -m unittest discover -s scripts/garmin
"""

import json
import unittest
from datetime import date
from pathlib import Path

from import_unofficial import chunks, ftp_rows, race_rows, readiness_row, training_row, vo2_rows, window

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


class TrainingRowTest(unittest.TestCase):
    def setUp(self):
        self.payload = json.loads((FIXTURES / "training-status.json").read_text())

    def test_reads_load_status_focus_and_vo2(self):
        row = training_row(self.payload, "2026-11-03")
        self.assertEqual(row["acute_load"], 237)
        self.assertEqual(row["chronic_load"], 172)
        self.assertEqual((row["chronic_low"], row["chronic_high"]), (137.6, 258.0))
        self.assertEqual(row["acwr"], 1.3)
        self.assertEqual(row["status"], "PRODUCTIVE")
        self.assertEqual(row["focus"]["aerobic_low"], {"value": 300.92786, "low": 80, "high": 240})
        self.assertEqual(row["focus"]["anaerobic"]["value"], 0.0)
        self.assertEqual(row["focus_feedback"], "ABOVE_TARGETS")
        self.assertEqual(row["vo2max"], 42.2)

    def test_skips_parts_dated_another_day(self):
        self.assertIsNone(training_row(self.payload, "2026-11-02"))
        self.assertIsNone(training_row(None, "2026-11-03"))


class RaceAndVo2Test(unittest.TestCase):
    def test_race_rows_per_day(self):
        rows = race_rows(json.loads((FIXTURES / "race-predictions-daily.json").read_text()))
        self.assertEqual(rows[0], {"local_date": "2026-10-28", "race_5k_s": 1775, "race_10k_s": 3884, "race_half_s": 9057, "race_marathon_s": 20718})
        self.assertEqual(len(rows), 7)
        self.assertEqual(race_rows(None), [])

    def test_vo2_rows_only_on_update_days(self):
        rows = vo2_rows(json.loads((FIXTURES / "max-metrics.json").read_text()))
        self.assertEqual([r["local_date"] for r in rows], ["2026-10-29", "2026-11-01", "2026-11-03"])
        self.assertEqual(rows[-1]["vo2max"], 42.2)

    def test_vo2_rows_add_cycling_on_its_own_days(self):
        payload = [
            {"generic": {"calendarDate": "2026-11-03", "vo2MaxPreciseValue": 42.2}, "cycling": {"calendarDate": "2026-11-03", "vo2MaxPreciseValue": 45.1}},
            {"generic": None, "cycling": {"calendarDate": "2026-11-05", "vo2MaxPreciseValue": 45.6}},
        ]
        self.assertEqual(
            vo2_rows(payload),
            [{"local_date": "2026-11-03", "vo2max": 42.2, "vo2max_cycling": 45.1}, {"local_date": "2026-11-05", "vo2max_cycling": 45.6}],
        )

    def test_training_row_reads_cycling_vo2_dated_that_day(self):
        payload = {"mostRecentVO2Max": {"generic": None, "cycling": {"calendarDate": "2026-11-05", "vo2MaxPreciseValue": 45.6}}}
        self.assertEqual(training_row(payload, "2026-11-05"), {"local_date": "2026-11-05", "vo2max_cycling": 45.6})
        self.assertIsNone(training_row(payload, "2026-11-04"))

    def test_ftp_rows_accept_the_latest_record_and_the_range_series(self):
        latest = {"calendarDate": "2026-11-01", "functionalThresholdPower": 182.4, "sport": "CYCLING"}
        self.assertEqual(ftp_rows(latest, "2026-11-08"), [{"local_date": "2026-11-01", "ftp_w": 182}])
        series = [{"from": "2026-10-01", "until": "2026-10-31", "value": 175.0}, {"from": "2026-11-01", "value": 182}]
        self.assertEqual(ftp_rows(series, "2026-11-08"), [{"local_date": "2026-10-01", "ftp_w": 175}, {"local_date": "2026-11-01", "ftp_w": 182}])
        self.assertEqual(ftp_rows({"functionalThresholdPower": 190}, "2026-11-08"), [{"local_date": "2026-11-08", "ftp_w": 190}])
        self.assertEqual(ftp_rows({"functionalThresholdPower": None}, "2026-11-08"), [])
        self.assertEqual(ftp_rows(None, "2026-11-08"), [])

    def test_chunks_cover_the_window_without_gaps(self):
        parts = list(chunks(date(2026, 1, 1), date(2026, 4, 15), 90))
        self.assertEqual(parts, [(date(2026, 1, 1), date(2026, 3, 31)), (date(2026, 4, 1), date(2026, 4, 15))])


class WindowTest(unittest.TestCase):
    def test_yesterday_also_takes_today(self):
        self.assertEqual(window(date(2026, 11, 3), 7, True, None), (date(2026, 11, 2), date(2026, 11, 3)))

    def test_days_and_since(self):
        self.assertEqual(window(date(2026, 11, 3), 7, False, None), (date(2026, 10, 28), date(2026, 11, 3)))
        self.assertEqual(window(date(2026, 11, 3), 7, False, date(2026, 9, 1)), (date(2026, 9, 1), date(2026, 11, 3)))


if __name__ == "__main__":
    unittest.main()
