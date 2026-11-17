-- The daily mood log (components/mood/): one row per day, each answer a 1-5 tap or a toggle,
-- every one optional and editable all day. Read by the Daily feel chart and summary, the chart
-- markers for sick and injured days, and later the weekly review (docs/plan-progress-tab.md).
create table if not exists mood_logs (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  sore_areas text[] not null default '{}',   -- legs | hips | back | shoulders | arms
  motivation smallint check (motivation between 1 and 5),
  sick boolean not null default false,
  injured boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
