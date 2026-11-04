-- Originally dropped garmin_token_cache when the import moved to the official Personal API.
-- The table came back with the hybrid import (005-recovery-sleep.sql: readiness and training
-- status still need the unofficial library's login session). Migrations re-run in order on
-- every `npm run db:migrate`, so this one must not drop it again: now a no-op.
select 1;
