-- The Garmin import moved to the official Personal API (lib/garmin/), which authenticates
-- with an API key from the environment, so the unofficial library's shared login session
-- is no longer needed. Already gone from db/schema.sql. Safe to re-run.
drop table if exists garmin_token_cache;
