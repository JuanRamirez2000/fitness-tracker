-- Adds daily step counts to a database created before they existed. Already part of
-- db/schema.sql, so a fresh database doesn't need this. Safe to re-run.
-- One row per day: that day's step count (from Garmin). Keyed by day, so a re-import of the
-- same day overwrites rather than duplicating.
create table if not exists daily_steps (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  steps int not null check (steps >= 0),
  source text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health')),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
