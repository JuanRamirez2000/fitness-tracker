-- Dashboard v2, Daily feel tab: per-day recovery and per-night sleep from Garmin, and the
-- unofficial library's shared login session. Already part of db/schema.sql, so a fresh
-- database doesn't need this. Safe to re-run.

-- One row per day of watch-derived recovery. The Personal API import (lib/garmin/) writes the
-- HRV, resting HR, Body Battery and stress columns; the unofficial import
-- (scripts/garmin/import_unofficial.py) writes the readiness columns. Each only updates its own.
create table if not exists daily_recovery (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  resting_hr smallint,
  hrv_ms numeric(5,1),                   -- overnight average, the night ending this morning
  hrv_baseline_low numeric(5,1),         -- Garmin's balanced range for this day
  hrv_baseline_high numeric(5,1),
  hrv_status text,                       -- BALANCED, UNBALANCED, LOW...
  body_battery_high smallint,
  body_battery_low smallint,
  body_battery_wake smallint,
  avg_stress smallint,
  readiness_score smallint,              -- the day's latest readiness snapshot
  readiness_level text,                  -- LOW, MODERATE, HIGH...
  readiness_factors jsonb,               -- {sleep, recovery_time, acwr, stress_history, hrv, sleep_history} percents
  readiness_at timestamptz,              -- when that snapshot was computed
  readiness_morning_score smallint,      -- the after-wake snapshot's score
  recovery_hours numeric(4,1),           -- recovery time left as of readiness_at
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- One row per night, keyed by the day it ended (the wake-up day), like Garmin.
create table if not exists sleep_nights (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  bedtime timestamptz,
  wake_time timestamptz,
  duration_s int,
  deep_s int,
  rem_s int,
  light_s int,
  awake_s int,
  score smallint,
  need_s int,                            -- Garmin's sleep need for that night
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- The unofficial Garmin login session, shared by a local run and the GitHub Actions job
-- (scripts/garmin/). Only the Python importer touches it; the app never does.
create table if not exists garmin_token_cache (
  id int primary key default 1,
  tokens jsonb not null,
  updated_at timestamptz not null default now(),
  constraint garmin_token_cache_single_row check (id = 1)
);
