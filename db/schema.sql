-- =====================================================================
-- Weight tracker schema: plain Postgres 15+ (Neon in production, PGlite locally).
-- Run once against an empty database: `psql "$DATABASE_URL" -f db/schema.sql`,
-- or let `npm run db:import` apply it for you.
--
-- There is no row-level security: the database is never exposed to the browser. Every
-- query runs server-side, and lib/auth/session.ts decides who may read or write.
-- =====================================================================

-- One row: the owner. The app reads the first profile (lib/data/profiles.ts).
create table profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  timezone text not null default 'America/Los_Angeles',
  program_start_date date,               -- heatmap window is anchored to this
  goal_weight_lb numeric(5,1),           -- progress-to-goal card and goal line
  goal_pace_lb_per_week numeric(3,1),    -- optional; draws a pace line when set
  start_weight_lb numeric(5,1),          -- optional override; default = first weigh-in
  hr_zone_bounds jsonb,                  -- [[low, high] x 5] bpm, from Garmin's zone settings
  hr_zone_bounds_cycling jsonb,          -- the same from Garmin's CYCLING zones (migration 014)
  shot_weekday smallint not null default 4
    check (shot_weekday between 0 and 6),  -- 0 = Sunday ... 4 = Thursday
  created_at timestamptz not null default now()
);

-- local_date is the day in the user's timezone, set by the app (never derive it from UTC).
-- The (user_id, source, external_id) unique index keeps Garmin imports idempotent.
create table weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  measured_at timestamptz not null,
  local_date date not null,
  weight_lb numeric(6,2) not null check (weight_lb between 50 and 800),
  source text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health')),
  external_id text,
  -- Body composition from the Index scale (null for manual entries). Fat mass = weight x pct.
  body_fat_pct numeric(4,1),
  muscle_mass_lb numeric(6,2),
  bone_mass_lb numeric(5,2),
  body_water_pct numeric(4,1),
  created_at timestamptz not null default now()
);
create index weigh_ins_user_date_idx on weigh_ins (user_id, local_date);
create unique index weigh_ins_source_uidx
  on weigh_ins (user_id, source, external_id) where external_id is not null;

-- Zepbound shots. The expected weekday is profiles.shot_weekday; a late or early shot is just
-- a row on its actual date, and lib/shots/match.ts lines shots up with the schedule.
create table injections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  dose_mg numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

-- One row per day: that day's step count (from Garmin). Keyed by day, so a re-import of the
-- same day overwrites rather than duplicating.
create table daily_steps (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  steps int not null check (steps >= 0),
  source text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health')),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- One row per Garmin activity (every type is kept; the app charts rides and runs, lib/sport.ts). The
-- (user_id, source, external_id) key keeps re-imports idempotent, like weigh_ins.
create table activities (
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
  hr_zone_s jsonb,                       -- [z1..z5] seconds in each HR zone
  elevation_loss_m numeric(7,1),
  max_speed_mps numeric(6,3),
  anaerobic_training_effect numeric(3,1),
  avg_power_w smallint,
  max_power_w smallint,
  norm_power_w smallint,
  avg_vertical_oscillation_cm numeric(4,1),
  avg_vertical_ratio numeric(4,1),
  min_temp_c numeric(4,1),
  max_temp_c numeric(4,1),
  body_battery_change smallint,          -- negative: Body Battery spent
  steps int,
  avg_cadence_rpm numeric(5,1),          -- rides (migration 014)
  max_cadence_rpm smallint,
  max_20min_power_w smallint,
  training_stress_score numeric(6,1),    -- Garmin's TSS and IF, against the FTP set in Garmin
  intensity_factor numeric(4,3),
  power_zone_s jsonb,                    -- [z1..z7] seconds in each power zone
  power_curve jsonb,                     -- {"<seconds>": watts}: best average power per duration
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index activities_user_date_idx on activities (user_id, local_date);

-- One row per activity of detail for the activity modal (migration 010): samples thinned to a
-- few hundred points, per-mile splits from the full-resolution samples, and Garmin's split
-- summaries, from /activity-service/activity/{id}(/details).
create table activity_details (
  activity_id uuid primary key references activities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  location_name text,
  workout_feel smallint,                 -- 0 (very weak) .. 100 (very strong)
  workout_rpe smallint,                  -- 10 .. 100 = RPE 1 .. 10
  min_hr smallint,
  stamina_start smallint,
  stamina_end smallint,
  series jsonb,                          -- ActivitySeries
  mile_splits jsonb,                     -- MileSplit[]
  interval_splits jsonb,                 -- IntervalSplit[]
  efforts jsonb,                         -- ActivityEfforts: best times and longest running (migration 012)
  ride_splits jsonb,                     -- RideSplit[]: rides' 5-mile splits (migration 014)
  fetched_at timestamptz not null default now()
);
create index activity_details_user_idx on activity_details (user_id);

-- The activity modal's AI summary (migration 011): one per activity, written once.
create table activity_summaries (
  activity_id uuid primary key references activities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  model text not null,
  generated_at timestamptz not null default now()
);

-- One row per day of watch-derived recovery. The Personal API import (lib/garmin/) writes the
-- HRV, resting HR, Body Battery and stress columns; the unofficial import
-- (scripts/garmin/import_unofficial.py) writes the readiness columns. Each only updates its own.
create table daily_recovery (
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
create table sleep_nights (
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

-- One row per day. The unofficial import (scripts/garmin/import_unofficial.py) writes the
-- training-status columns; the Personal API import writes fitness age. Each updates only its own.
create table daily_training (
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
  race_marathon_s int,                   -- migration 013
  vo2max_cycling numeric(4,1),           -- cycling VO2 max (migration 014)
  ftp_w smallint,                        -- cycling FTP set in Garmin (migration 014)
  fitness_age numeric(4,1),
  fitness_age_achievable numeric(4,1),
  chronological_age smallint,
  fitness_age_factors jsonb,             -- Garmin's components, with priority
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- The AI-written summaries (app/api/summary/cron), one per tab per day.
create table daily_summaries (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  tab text not null default 'today',     -- today | weight | training
  text text not null,
  model text,                            -- the model that wrote it
  next_sessions jsonb,                   -- training tab: [{date, title, details, source}] (migration 015)
  generated_at timestamptz not null default now(),
  primary key (user_id, local_date, tab)
);

-- Planned sessions from a Garmin Coach plan (migration 015), written by the unofficial import's
-- "plan" dataset. Future rows are replaced on each run, since an adaptive plan reshuffles.
create table planned_workouts (
  user_id uuid not null references profiles(id) on delete cascade,
  workout_uuid text not null,
  local_date date not null,
  sport text,
  name text,
  description text,
  duration_s integer,
  benefit text,
  rest_day boolean not null default false,
  key_workout boolean not null default false,
  status text,
  plan_name text,
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_uuid)
);
create index planned_workouts_user_date_idx on planned_workouts (user_id, local_date);

-- The unofficial Garmin login session, shared by a local run and the GitHub Actions job
-- (scripts/garmin/). Only the Python importer touches it; the app never does.
create table garmin_token_cache (
  id int primary key default 1,
  tokens jsonb not null,
  updated_at timestamptz not null default now(),
  constraint garmin_token_cache_single_row check (id = 1)
);


-- ---------- Views ----------

-- Earliest weigh-in of each local day is the one that counts.
create view daily_weight as
select distinct on (user_id, local_date)
  user_id, local_date, weight_lb, measured_at, source
from weigh_ins
order by user_id, local_date, measured_at;

-- Raw + 7-day-average series with day-over-day deltas.
-- Deltas compare against the previous RECORDED day (gaps are not zero-filled).
-- n7 = weigh-ins inside the window; the app should treat n7 < 3 as "warming up".
create view weight_trend as
with base as (
  select
    user_id, local_date, weight_lb,
    avg(weight_lb) over w7 as avg7_lb,
    count(*) over w7 as n7
  from daily_weight
  window w7 as (
    partition by user_id order by local_date
    range between interval '6 days' preceding and current row
  )
)
select
  user_id, local_date, weight_lb,
  round(avg7_lb, 2) as avg7_lb,
  n7,
  weight_lb - lag(weight_lb) over w as raw_delta_lb,
  avg7_lb - lag(avg7_lb) over w as avg7_delta_lb
from base
window w as (partition by user_id order by local_date);
