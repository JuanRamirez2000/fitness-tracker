-- Adds Garmin workouts to a database created before they existed. Already part of
-- db/schema.sql, so a fresh database doesn't need this. Safe to re-run.
-- One row per Garmin activity (every type is kept; the app charts the runs). The
-- (user_id, source, external_id) key keeps re-imports idempotent, like weigh_ins.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'garmin' check (source in ('manual', 'garmin', 'apple_health')),
  external_id text not null,
  activity_type text not null,           -- Garmin's typeKey: running, treadmill_running, walking...
  name text,
  started_at timestamptz not null,
  local_date date not null,              -- the start's day in the athlete's own timezone
  duration_s numeric(9,1) not null,
  moving_duration_s numeric(9,1),
  distance_m numeric(9,1),
  elevation_gain_m numeric(7,1),
  avg_speed_mps numeric(6,3),
  avg_grade_adjusted_speed_mps numeric(6,3),
  avg_hr smallint,
  max_hr smallint,
  avg_cadence_spm numeric(5,1),
  avg_stride_cm numeric(5,1),
  avg_ground_contact_ms numeric(5,1),
  calories int,
  aerobic_training_effect numeric(3,1),
  training_effect_label text,            -- RECOVERY, AEROBIC_BASE, TEMPO, THRESHOLD, VO2MAX...
  training_load numeric(6,1),
  vo2max smallint,
  fastest_mile_s numeric(7,1),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index if not exists activities_user_date_idx on activities (user_id, local_date);
