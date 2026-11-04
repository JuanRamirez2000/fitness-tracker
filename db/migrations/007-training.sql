-- Dashboard v2, Training tab: seconds in each HR zone per activity, the athlete's zone bounds,
-- and a daily training snapshot (load, status, load focus, and later race predictions,
-- fitness age and VO2 max). Already part of db/schema.sql. Safe to re-run.

-- [z1, z2, z3, z4, z5] seconds, from the Personal API activity list (hrTimeInZone_1..5).
alter table activities add column if not exists hr_zone_s jsonb;

-- [[low, high] x 5] bpm, from Garmin's own HR zone settings (heartRateZones/v2).
alter table profiles add column if not exists hr_zone_bounds jsonb;

-- One row per day. The unofficial import (scripts/garmin/import_unofficial.py) writes the
-- training-status columns; the Personal API import writes fitness age. Each updates only its own.
create table if not exists daily_training (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  acute_load numeric(6,1),
  chronic_load numeric(6,1),
  chronic_low numeric(6,1),              -- Garmin's optimal chronic band for the day
  chronic_high numeric(6,1),
  acwr numeric(4,2),
  status text,                           -- PRODUCTIVE, MAINTAINING, RECOVERY, ...
  focus jsonb,                           -- {aerobic_low|aerobic_high|anaerobic: {value, low, high}}
  focus_feedback text,                   -- ABOVE_TARGETS, BALANCED, ...
  vo2max numeric(4,1),                   -- running VO2 max, when Garmin updated it that day
  race_5k_s int,
  race_10k_s int,
  race_half_s int,
  fitness_age numeric(4,1),
  fitness_age_achievable numeric(4,1),
  chronological_age smallint,
  fitness_age_factors jsonb,             -- Garmin's components, with priority
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
