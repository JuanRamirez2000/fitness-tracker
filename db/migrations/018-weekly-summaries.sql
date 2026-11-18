-- The Progress tab's weekly review (lib/summary/weekly.ts): one row per Monday-to-Sunday week.
-- Tuesday to Sunday the morning cron rewrites the current week's "so far" review (final =
-- false); on Monday it writes the finished week's final one. emailed_at keeps the Monday email
-- from going out twice (docs/plan-progress-tab.md, step 5).
create table if not exists weekly_summaries (
  user_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,                  -- the Monday
  final boolean not null default false,      -- false = "week so far"
  headline text not null,
  sections jsonb not null,                   -- {wins: [], watch: [], next: []}
  model text,
  generated_at timestamptz not null default now(),
  emailed_at timestamptz,
  primary key (user_id, week_start)
);
