-- Dashboard v2, Daily feel tab: the AI-written daily summary. Generated once each morning
-- by the summary cron (app/api/summary/cron) after that morning's import, stored, and never
-- generated per page view. Already part of db/schema.sql. Safe to re-run.
create table if not exists daily_summaries (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  text text not null,
  model text,                            -- the model that wrote it (it may be a fallback)
  generated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
