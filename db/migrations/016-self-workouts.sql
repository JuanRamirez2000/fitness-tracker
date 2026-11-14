-- Self-made workouts (lib/workouts/): sessions the tracker builds for the sports the Garmin
-- Coach plan isn't covering, sent to the Garmin calendar by scripts/garmin/push_workout.py.
-- They live in planned_workouts next to the Coach sessions, told apart by `source`; the Coach
-- import (scripts/garmin/import_unofficial.py) only replaces source = 'garmin' rows.
alter table planned_workouts add column if not exists source text not null default 'garmin';  -- garmin | self
alter table planned_workouts add column if not exists settings jsonb;          -- the builder's inputs: sport, kind, effort, minutes
alter table planned_workouts add column if not exists steps jsonb;             -- the builder's step list, for display
alter table planned_workouts add column if not exists garmin_workout jsonb;    -- the workout JSON uploaded to Garmin
alter table planned_workouts add column if not exists push_status text;        -- draft | queued | sent | failed | removing
alter table planned_workouts add column if not exists push_error text;
alter table planned_workouts add column if not exists garmin_workout_id bigint;
alter table planned_workouts add column if not exists garmin_schedule_id bigint;
alter table planned_workouts add column if not exists pushed_at timestamptz;
create index if not exists planned_workouts_push_idx on planned_workouts (push_status) where source = 'self';

-- The builder's settings that Garmin doesn't hold (lib/workouts/settings.ts): FTP override,
-- swim stage, pool, A race, swim and long-session days, weekly hour limit. Null = defaults.
alter table profiles add column if not exists workout_settings jsonb;
