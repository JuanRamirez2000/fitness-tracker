-- Planned sessions from a Garmin Coach plan (the unofficial import's "plan" dataset,
-- scripts/garmin/import_unofficial.py), and the Training summary's "Next up" sessions.
create table if not exists planned_workouts (
  user_id uuid not null references profiles(id) on delete cascade,
  workout_uuid text not null,
  local_date date not null,
  sport text,                         -- Garmin's sportTypeKey: cycling, running, ...
  name text,                          -- "Tempo", "Long Ride"; null on a rest day
  description text,                   -- Garmin's shorthand: "3x9:00@210W"
  duration_s integer,                 -- Garmin's estimate
  benefit text,                       -- Garmin's training-effect label: TEMPO, AEROBIC_BASE, ...
  rest_day boolean not null default false,
  key_workout boolean not null default false,
  status text,                        -- NOT_COMPLETE, COMPLETE, SKIPPED, ...
  plan_name text,
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_uuid)
);
create index if not exists planned_workouts_user_date_idx on planned_workouts (user_id, local_date);

alter table daily_summaries add column if not exists next_sessions jsonb;
