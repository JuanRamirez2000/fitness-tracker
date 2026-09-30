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
  created_at timestamptz not null default now()
);
create index weigh_ins_user_date_idx on weigh_ins (user_id, local_date);
create unique index weigh_ins_source_uidx
  on weigh_ins (user_id, source, external_id) where external_id is not null;

-- The Garmin session, shared between the nightly GitHub Actions job and a local Mac
-- (see scripts/garmin/README.md). Only the importer touches it; the app never does.
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
