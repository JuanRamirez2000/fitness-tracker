-- The AI summary at the top of the activity modal: one per activity, written once (by the
-- morning summary cron for new activities, or on the owner's first open of an older one).
create table if not exists activity_summaries (
  activity_id uuid primary key references activities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  model text not null,
  generated_at timestamptz not null default now()
);
