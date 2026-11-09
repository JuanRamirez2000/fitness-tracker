-- Cycling: the ride fields Garmin's activity list always sent but the import dropped, Garmin's
-- separate cycling HR zones, 5-mile ride splits for the activity modal, and cycling VO2 max and
-- FTP from the unofficial import (scripts/garmin/import_unofficial.py).
alter table activities add column if not exists avg_cadence_rpm numeric(5,1);
alter table activities add column if not exists max_cadence_rpm smallint;
alter table activities add column if not exists max_20min_power_w smallint;
alter table activities add column if not exists training_stress_score numeric(6,1);
alter table activities add column if not exists intensity_factor numeric(4,3);
alter table activities add column if not exists power_zone_s jsonb;
alter table activities add column if not exists power_curve jsonb;

alter table profiles add column if not exists hr_zone_bounds_cycling jsonb;

alter table activity_details add column if not exists ride_splits jsonb;

alter table daily_training add column if not exists vo2max_cycling numeric(4,1);
alter table daily_training add column if not exists ftp_w smallint;
