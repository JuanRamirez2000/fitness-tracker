-- Each run's best efforts (lib/garmin/efforts.ts): fastest mile, 2 miles and 5K anywhere in the
-- run, and its longest continuous running. Worked out at import from the full-resolution samples;
-- older rows from their stored series (scripts/backfill-efforts.ts).
alter table activity_details add column if not exists efforts jsonb;
