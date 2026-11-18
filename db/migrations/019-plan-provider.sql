-- Who planned a session on the Garmin calendar, read from the workout's detail by the plan
-- import (scripts/garmin/import_unofficial.py): "Garmin Coach", the app that pushed it
-- ("Runna", "TrainingPeaks"...), or null for a workout made in Garmin Connect. The planner
-- treats a sport with sessions from a provider as coached (lib/workouts/plan.ts).
-- duration_estimated: Garmin gave no time, so the import worked one out from the steps or the
-- distance (shown with a "~").
alter table planned_workouts add column if not exists provider text;
alter table planned_workouts add column if not exists duration_estimated boolean not null default false;
