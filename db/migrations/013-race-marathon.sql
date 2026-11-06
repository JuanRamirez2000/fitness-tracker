-- Garmin's predicted marathon time, which its race predictions always carried but the unofficial
-- import used to drop (scripts/garmin/import_unofficial.py, race_rows).
alter table daily_training add column if not exists race_marathon_s int;
