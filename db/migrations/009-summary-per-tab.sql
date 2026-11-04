-- One AI summary per dashboard tab (today, weight, training) per day, instead of one per day.
-- Existing rows are the Daily feel tab's. Already part of db/schema.sql. Safe to re-run.
alter table daily_summaries add column if not exists tab text not null default 'today';
alter table daily_summaries drop constraint if exists daily_summaries_pkey;
alter table daily_summaries add primary key (user_id, local_date, tab);
