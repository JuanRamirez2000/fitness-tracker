-- The activity modal: the activity list's fields the import used to drop, and one row per
-- activity of detail from /activity-service/activity/{id}(/details) (lib/garmin/map.ts,
-- buildActivityDetailRow). Idempotent, like every migration here.

alter table activities
  add column if not exists elevation_loss_m numeric(7,1),
  add column if not exists max_speed_mps numeric(6,3),
  add column if not exists anaerobic_training_effect numeric(3,1),
  add column if not exists avg_power_w smallint,
  add column if not exists max_power_w smallint,
  add column if not exists norm_power_w smallint,
  add column if not exists avg_vertical_oscillation_cm numeric(4,1),
  add column if not exists avg_vertical_ratio numeric(4,1),
  add column if not exists min_temp_c numeric(4,1),
  add column if not exists max_temp_c numeric(4,1),
  add column if not exists body_battery_change smallint,   -- negative: Body Battery spent
  add column if not exists steps int;

create table if not exists activity_details (
  activity_id uuid primary key references activities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  location_name text,
  workout_feel smallint,          -- Garmin's 0 (very weak) .. 100 (very strong), as logged after the run
  workout_rpe smallint,           -- Garmin's 10 .. 100 = RPE 1 .. 10
  min_hr smallint,
  stamina_start smallint,         -- potential stamina, percent
  stamina_end smallint,
  series jsonb,                   -- columnar samples thinned to a few hundred points (ActivitySeries)
  mile_splits jsonb,              -- per mile, from the full-resolution samples (MileSplit[])
  interval_splits jsonb,          -- Garmin's split summaries by type: run/walk, warm-up, active... (IntervalSplit[])
  fetched_at timestamptz not null default now()
);
create index if not exists activity_details_user_idx on activity_details (user_id);
