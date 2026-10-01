-- Adds shot tracking to a database created before it existed. Already part of db/schema.sql,
-- so a fresh database doesn't need this. Safe to re-run.
alter table profiles add column if not exists shot_weekday smallint not null default 4
  check (shot_weekday between 0 and 6);

-- Zepbound shots. The expected weekday is profiles.shot_weekday; a late or early shot is just
-- a row on its actual date, and lib/shots/match.ts lines shots up with the schedule.
create table if not exists injections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  dose_mg numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
