-- =====================================================================
-- Weight & logging tracker (schema v3): Supabase / Postgres 15+
-- Run once in the Supabase SQL editor (or save as a migration).
-- BEFORE running: Auth > Providers > Email > turn OFF "Allow new users to sign up".
-- =====================================================================

-- ---------- People & access ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'owner' check (role in ('owner', 'coach')),
  timezone text not null default 'America/Los_Angeles',
  program_start_date date,               -- heatmap window is anchored to this
  goal_weight_lb numeric(5,1),           -- progress-to-goal card and goal line
  goal_pace_lb_per_week numeric(3,1),    -- optional; draws a pace line when set
  start_weight_lb numeric(5,1),          -- optional override; default = first weigh-in
  shot_weekday smallint not null default 4
    check (shot_weekday between 0 and 6),  -- 0 = Sunday ... 4 = Thursday
  steps_goal int not null default 10000, -- "steps hit" threshold for the Logged heatmap
  calorie_target_kcal int,               -- V1
  created_at timestamptz not null default now()
);

-- Coach reads AND writes an athlete's data only if a row exists here (managed via SQL,
-- no UI). Product decision for this app: the coach is one trusted, known second account
-- with full parity, not a stranger with read-only access.
create table public.coach_access (
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  primary key (athlete_id, coach_id)
);

-- ---------- Lookups ----------

create table public.activity_types (
  key text primary key,
  label text not null,
  color text not null,                   -- hex, drives heatmap + legend
  sort_order int not null default 0
);

-- Steps are a numeric metric (daily_metrics.steps), not an activity type.
insert into public.activity_types (key, label, color, sort_order) values
  ('run',       'Run',       '#F97316', 1),
  ('lift',      'Lifting',   '#A855F7', 2),  -- lifting = this type + free-text notes
  ('walk',      'Walk',      '#14B8A6', 4),
  ('ride',      'Ride',      '#EC4899', 5),
  ('swim',      'Swim',      '#06B6D4', 6),
  ('other',     'Other',     '#94A3B8', 7);

-- Numeric per-day metrics live in daily_metrics; a new tab = a new row here, no migration.
create table public.metric_definitions (
  key text primary key,
  label text not null,
  unit text not null
);

insert into public.metric_definitions (key, label, unit) values
  ('steps',       'Steps',    'steps'),
  ('sleep_hours', 'Sleep',    'h'),
  ('protein_g',   'Protein',  'g');

-- ---------- Tracking tables ----------
-- local_date is the day in the user's timezone, set by the app (never derive it from UTC).
-- (user_id, source, external_id) unique indexes make future Garmin / Apple imports idempotent.

create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measured_at timestamptz not null,
  local_date date not null,
  weight_lb numeric(6,2) not null check (weight_lb between 50 and 800),
  source text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health')),
  external_id text,
  created_at timestamptz not null default now()
);
create index weigh_ins_user_date_idx on public.weigh_ins (user_id, local_date);
create unique index weigh_ins_source_uidx
  on public.weigh_ins (user_id, source, external_id) where external_id is not null;

-- One row per day: daily calorie total (UI in V1) and how trustworthy tracking was.
create table public.nutrition_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  tracking_status text not null check (tracking_status in ('accurate', 'uncertain', 'missed')),
  calories_kcal int check (calories_kcal between 0 and 20000),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- Many per day allowed; the UI renders "multiple" when a day has more than one.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  activity_type text not null references public.activity_types(key),
  duration_min int check (duration_min > 0),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health')),
  external_id text,
  created_at timestamptz not null default now()
);
create index activities_user_date_idx on public.activities (user_id, local_date);
create unique index activities_source_uidx
  on public.activities (user_id, source, external_id) where external_id is not null;

-- Shot day. The expected weekday lives in profiles.shot_weekday; a late shot is simply
-- a row on the actual date (the app matches shots to the schedule, see build brief).
create table public.injections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  dose_mg numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

-- Numeric per-day metrics. Steps are used in V0 (steps_goal drives the Logged heatmap);
-- sleep and protein are V1. Created now so later metrics need no migration.
create table public.daily_metrics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  metric text not null references public.metric_definitions(key),
  value numeric not null,
  source text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health')),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date, metric)
);

-- Lets scripts/garmin/import_garmin.py share one Garmin login session between the local
-- Mac and the GitHub Actions nightly job, instead of the session only ever living in
-- ~/.garminconnect on one machine. RLS enabled with zero policies: unreachable via the
-- anon/authenticated REST API on purpose, only the service-role key (which bypasses RLS
-- entirely) can read or write it — same "service-role only" posture as every other script
-- in this repo, just persisted in Postgres instead of a local file.
create table public.garmin_token_cache (
  id int primary key default 1,
  tokens jsonb not null,
  updated_at timestamptz not null default now(),
  constraint garmin_token_cache_single_row check (id = 1)
);
alter table public.garmin_token_cache enable row level security;

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'planned', 'done', 'dismissed')),
  created_at timestamptz not null default now()
);

-- ---------- Views ----------

-- Earliest weigh-in of each local day is the one that counts.
create view public.daily_weight with (security_invoker = true) as
select distinct on (user_id, local_date)
  user_id, local_date, weight_lb, measured_at, source
from public.weigh_ins
order by user_id, local_date, measured_at;

-- Raw + 7-day-average series with day-over-day deltas.
-- Deltas compare against the previous RECORDED day (gaps are not zero-filled).
-- n7 = weigh-ins inside the window; the app should treat n7 < 3 as "warming up".
create view public.weight_trend with (security_invoker = true) as
with base as (
  select
    user_id, local_date, weight_lb,
    avg(weight_lb) over w7 as avg7_lb,
    count(*) over w7 as n7
  from public.daily_weight
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

-- ---------- Row level security ----------
-- Owner and coach have identical access to the owner's rows (see coach_access above).
--
-- can_read() lives in the `private` schema, not `public`: PostgREST only auto-exposes
-- functions in the schemas it serves (public, by default), so a function in `private` is
-- unreachable as a REST endpoint (no POST /rest/v1/rpc/can_read) while remaining callable
-- from inside RLS policies on public tables, which Postgres evaluates directly. This is
-- Supabase's own recommended fix for a SECURITY DEFINER helper that should only ever run
-- inside a policy: https://supabase.com/docs/guides/database/database-linter?lint=0028
-- Functions get PUBLIC execute by default, so grants must be set explicitly.

create schema if not exists private;

create function private.can_read(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or exists (
      select 1 from public.coach_access
      where coach_id = auth.uid() and athlete_id = target
    );
$$;
revoke all on function private.can_read(uuid) from public;
grant execute on function private.can_read(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['weigh_ins', 'nutrition_days', 'activities', 'injections', 'daily_metrics']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- for all: the coach can insert, update and delete here too, not just read.
    execute format(
      'create policy "own or coached" on public.%I for all to authenticated
         using (private.can_read(user_id)) with check (private.can_read(user_id))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "read own or coached" on public.profiles
  for select to authenticated using (private.can_read(id));
-- update only (not "for all"): profiles cascade-deletes all of that user's tracking data,
-- so this deliberately never grants delete or insert, even to a coach.
create policy "update own or coached" on public.profiles
  for update to authenticated using (private.can_read(id)) with check (private.can_read(id));

alter table public.coach_access enable row level security;
create policy "see own links" on public.coach_access
  for select to authenticated using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()));

alter table public.activity_types enable row level security;
create policy "read all" on public.activity_types for select to authenticated using (true);

alter table public.metric_definitions enable row level security;
create policy "read all" on public.metric_definitions for select to authenticated using (true);

-- Only two trusted accounts exist, so both can read and triage requests.
alter table public.feature_requests enable row level security;
create policy "read all" on public.feature_requests for select to authenticated using (true);
create policy "insert as self" on public.feature_requests
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "update any" on public.feature_requests
  for update to authenticated using (true) with check (true);

-- ---------- Auto-create a profile for each new auth user ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nothing calls this directly; auth.users insert triggers it regardless of grants
-- (trigger firing isn't gated by the querying role's EXECUTE privilege on the trigger
-- function). Revoking it here just closes the same PostgREST RPC exposure as can_read.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- =====================================================================
-- ONE-TIME SETUP after creating the two users in Auth > Users
-- (replace the UUIDs; run separately):
--
--   update public.profiles
--     set program_start_date = '2026-09-17',   -- confirm this is the right start day
--         goal_weight_lb = 200,
--         shot_weekday = 4                     -- 0 = Sunday ... 4 = Thursday
--     where id = '<YOUR_USER_UUID>';
--
--   update public.profiles set role = 'coach' where id = '<COACH_USER_UUID>';
--
--   insert into public.coach_access (athlete_id, coach_id)
--     values ('<YOUR_USER_UUID>', '<COACH_USER_UUID>');
-- =====================================================================

-- =====================================================================
-- ALREADY RAN v1? Apply this migration instead of re-running everything:
--
--   alter table public.profiles
--     add column goal_weight_lb numeric(5,1),
--     add column goal_pace_lb_per_week numeric(3,1),
--     add column start_weight_lb numeric(5,1),
--     add column shot_weekday smallint not null default 4 check (shot_weekday between 0 and 6),
--     add column steps_goal int not null default 10000,
--     add column calorie_target_kcal int;
--
--   alter table public.nutrition_days
--     add column calories_kcal int check (calories_kcal between 0 and 20000);
--
--   delete from public.metric_definitions where key = 'calories_in';
--   delete from public.activity_types where key = 'steps_10k';
--
-- Then also apply the v2 -> v3 migration below.
-- =====================================================================

-- =====================================================================
-- ALREADY RAN v2 (the version with `create policy "write own" ... using (user_id = ...)`)?
-- Apply this instead of re-running everything: it moves the RLS helper out of the schema
-- PostgREST exposes (an advisor-recommended fix, not a behavior change on its own) and
-- gives the coach full read/write parity with the owner (a real access change: a coach
-- account could previously only read, and could still write rows under its own user_id;
-- now it can insert, update and delete the athlete's rows too).
--
--   create schema if not exists private;
--   alter function public.can_read(uuid) set schema private;
--   revoke all on function private.can_read(uuid) from public;
--   grant execute on function private.can_read(uuid) to authenticated;
--
--   revoke all on function public.handle_new_user() from public, anon, authenticated;
--
--   do $$
--   declare t text;
--   begin
--     foreach t in array array['weigh_ins', 'nutrition_days', 'activities', 'injections', 'daily_metrics']
--     loop
--       execute format('drop policy "read own or coached" on public.%I', t);
--       execute format('drop policy "write own" on public.%I', t);
--       execute format(
--         'create policy "own or coached" on public.%I for all to authenticated
--            using (private.can_read(user_id)) with check (private.can_read(user_id))', t);
--     end loop;
--   end $$;
--
--   drop policy "read own or coached" on public.profiles;
--   drop policy "update own" on public.profiles;
--   create policy "read own or coached" on public.profiles
--     for select to authenticated using (private.can_read(id));
--   create policy "update own or coached" on public.profiles
--     for update to authenticated using (private.can_read(id)) with check (private.can_read(id));
-- =====================================================================
