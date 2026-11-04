# Garmin fields for dashboard v2

Where each field the v2 dashboard needs comes from. Checked on 2026-11-03 with real calls
against the Garmin Connect **Personal API** (`personal.connectapi.garmin.com`, the official
API `lib/garmin/client.ts` uses), for an Enduro 3 watch and an Index scale. Anonymised
sample responses live in `lib/garmin/fixtures/`.

The Personal API does **not** serve training readiness, training status (acute and chronic
load, ACWR, load focus), race predictions, daily VO2 max or endurance score: every such path
returns 404. The owner chose a hybrid (2026-11-04): those fields come from the unofficial
`python-garminconnect` library (see "Unofficial API" below), everything else from the
Personal API.

## Personal API endpoints

All paths are relative to `https://personal.connectapi.garmin.com`. Dates are the athlete's
local calendar days (`YYYY-MM-DD`).

| Endpoint | Max days per request | Fixture |
| --- | --- | --- |
| `GET /sleep-service/sleep/dailySleepSummariesByDate?startDate=&endDate=` | 31 (32 worked) | `sleep-summaries.json` |
| `GET /hrv-service/hrv/daily/{start}/{end}` | 60 worked; use 31 | `hrv-daily.json` |
| `GET /usersummary-service/usersummary/daily?calendarDate=` | 1 (one day per call) | `usersummary-daily.json` |
| `GET /weight-service/weight/range/{start}/{end}?includeAll=true` | 400 worked | `weight-range.json` |
| `GET /activitylist-service/activities/search/activities?startDate=&endDate=&start=&limit=` | paged, 100 per page | `activity-search.json` |
| `GET /biometric-service/heartRateZones/v2?generateDefaults=true` | n/a (current settings) | `heart-rate-zones.json` |
| `GET /fitnessage-service/fitnessage/v2/{date}?fullHistoryScan=true` | 1 | `fitness-age.json` |
| `GET /usersummary-service/stats/steps/daily/{start}/{end}` | **28** (29 returns 400) | (already imported) |

Also present but not needed: `/sleep-service/sleep/dailySleep?date=` (same record as the
range endpoint, one day), `/usersummary-service/v2/dailysummaries` (Body Battery min/max
but no wake value), `/wellness-service/wellness/bodyBattery/reports/daily` (31-day cap,
a few samples a day, no wake value), `/wellness-service/wellness/dailyHeartRate?date=`,
`/usersummary-service/stats/stress/daily/{start}/{end}` (28-day cap),
`/activity-service/activity/{id}` (no zone or VO2 fields), `/userprofile-service/userprofile/settings`
(no birth date).

A day with no data comes back as a record whose fields are all null (sleep), as a missing
entry (HRV, for a night not processed yet), or as an empty body
(`/hrv-service/hrv/{date}` for a future day).

## Fields by chart

Units are Garmin's. Conversions happen in the pure mapping functions (`lib/garmin/map.ts`).

### Sleep (`sleep_nights`, keyed by the wake-up day)

From `dailySleepSummariesByDate`, one array entry per night. `calendarDate` is the
**wake-up day** (the night of Nov 2→3 is `2026-11-03`).

| Field | JSON path | Unit |
| --- | --- | --- |
| local_date | `calendarDate` | date |
| duration | `sleepTimeSeconds` | s |
| deep / light / REM / awake | `deepSleepSeconds`, `lightSleepSeconds`, `remSleepSeconds`, `awakeSleepSeconds` | s |
| sleep score | `sleepScores.overall.value` (label `sleepScores.overall.qualifierKey`) | 0–100 |
| bedtime | `sleepStartTimestampGMT` | epoch ms, UTC |
| wake time | `sleepEndTimestampGMT` | epoch ms, UTC |
| sleep need | `sleepNeed.actual` (baseline `sleepNeed.baseline`) | **minutes** |

`sleepStartTimestampLocal` is local wall time encoded as if it were UTC; use the GMT value
and `lib/dates/timezone.ts` instead. Sleep need is Garmin's own (460 min on Nov 3), not a
fixed 8 h.

### Resting HR, HRV, Body Battery, stress (`daily_recovery`)

HRV from `hrv/daily/{start}/{end}`, entries under `hrvSummaries[]`:

| Field | JSON path | Unit |
| --- | --- | --- |
| local_date | `calendarDate` (the morning after the night measured) | date |
| overnight HRV | `lastNightAvg` | ms |
| baseline low / high | `baseline.balancedLow`, `baseline.balancedUpper` | ms |
| status | `status` (`BALANCED`, `UNBALANCED`, `LOW`, …) | text |

The rest from `usersummary/daily`, one call per day:

| Field | JSON path | Unit |
| --- | --- | --- |
| resting HR | `restingHeartRate` | bpm |
| Body Battery high / low | `bodyBatteryHighestValue`, `bodyBatteryLowestValue` | 0–100 |
| Body Battery at wake | `bodyBatteryAtWakeTime` | 0–100 |
| average stress | `averageStressLevel` | 0–100 |

### Body composition (columns on `weigh_ins`)

From `weight/range?includeAll=true`, already called by the weigh-in import. Each entry of
`dailyWeightSummaries[].allWeightMetrics[]`; `samplePk` is the existing `external_id`.

| Field | JSON path | Unit |
| --- | --- | --- |
| weight | `weight` | g |
| body fat | `bodyFat` | % |
| muscle mass | `muscleMass` | g |
| bone mass | `boneMass` | g |
| body water | `bodyWater` | % |
| source | `sourceType` (`INDEX_SCALE`, `MANUAL`) | text |

Garmin gives no fat mass: fat mass = weight × body fat %, lean mass = weight − fat mass,
"other" in the composition donut = weight − fat − muscle − bone. Manual entries have null
composition. Index scale composition starts **2026-09-02** (59 of 71 weigh-ins since
Sep 1), so the "since" stats and the chart note say "scale data starts Sep 2".

### Time in HR zones

Per activity, from the activity list the importer already calls: `hrTimeInZone_1` …
`hrTimeInZone_5`, in seconds (fractional). Store as `activities.hr_zone_s` = `[z1..z5]`.

Zone bounds from `heartRateZones/v2`: an array with one entry per sport. Use
`sport = "DEFAULT"` (running uses it; there is also `CYCLING`). Floors in bpm:
`zone1Floor` … `zone5Floor`, top of Z5 = `maxHeartRateUsed`. Zone N spans
`[zoneNFloor, zone(N+1)Floor - 1]`. Today: Z1 101–120, Z2 121–140, Z3 141–160,
Z4 161–180, Z5 181–201 (`trainingMethod: HR_MAX`).

### Fitness age (`daily_training`)

From `fitnessage/v2/{date}`:

| Field | JSON path | Unit |
| --- | --- | --- |
| fitness age | `fitnessAge` | years (fractional) |
| real age | `chronologicalAge` | years |
| achievable | `achievableFitnessAge` | years |
| factors | `components.{bodyFat, vigorousMinutesAvg, vigorousDaysAvg, rhr}` | see below |

Each component has `value`, and those that can improve also have `targetValue`,
`potentialAge` and `priority` (1 = largest lever). That is enough for the "What would
lower fitness age" ranked list: order by `priority`, tag priority 1 as "largest lever".
Body fat is priority 1 today. `rhr` has no target or priority (shown as context only).

### Runs table and run KPIs

Already imported from the activity list. `trainingEffectLabel` (`TEMPO`, `RECOVERY`,
`BASE`, …) and `aerobicTrainingEffect` drive the Effect column.

**Gap found:** the Personal API's activity list has **no `vO2MaxValue`**. Runs imported
since the move to the Personal API (2026-11-03) store `vo2max = null`, so the VO2 max KPI
only reflects older runs. VO2 max now has to come from the unofficial API's max metrics.

## Unofficial API (hybrid)

Not reachable with the Personal API key (404 on `personal.connectapi.garmin.com`). These
come from `python-garminconnect` on `connectapi.garmin.com` with a logged-in session. The method
names are the library's; their JSON paths are not confirmed yet and will be added here, with
fixtures, from real payloads once the login is restored.

| Chart | Fields | Library method (endpoint) |
| --- | --- | --- |
| Readiness hero | score, level, six factor percentages, recovery hours | `get_training_readiness(date)` (`/metrics-service/metrics/trainingreadiness/{date}`) |
| Training load, load focus | acute and chronic load, optimal chronic band, ACWR, status label; aerobic low / high / anaerobic with targets | `get_training_status(date)` (`/metrics-service/metrics/trainingstatus/aggregated/{date}`) |
| Race predictions | 5K, 10K, half marathon seconds | `get_race_predictions()` (`/metrics-service/metrics/racepredictions/latest/{displayName}`) |
| VO2 max (daily) | running VO2 max | `get_max_metrics(date)` (`/metrics-service/metrics/maxmet/daily/{start}/{end}`) |

Readiness is computed when the athlete wakes, so these are fetched in the morning, not at
the 1 AM nightly run (which would only ever see the previous day).

## Charts that lose data without the unofficial API

If the unofficial import stops working (expired session, Garmin blocks it), these cards show
their empty state rather than invented values: the readiness ring, the six factor rows and
"Recovery left" in the Today hero; Training load; Load focus; Race predictions; and VO2 max
for new runs. Everything else stays on the Personal API.

## Importer notes

- Steps (and stress) are capped at 28 days per request: `GarminClient.steps()` currently
  sends the whole window, so `npm run garmin:import -- --days 365` fails on steps. Split
  into 28-day windows.
- Sleep and HRV land on the wake-up day, so the nightly run must also fetch today, and it
  re-fetches the previous day because Garmin syncs late.
- `usersummary/daily` and `fitnessage/v2` take one day per call: a backfill since
  2026-09-01 is ~65 calls each. Space them out (the client already surfaces 429).
- Do not write body composition for weigh-ins before `program_start_date` in a way that
  moves `start_weight_lb` or the heatmap's first day: composition is extra columns on the
  existing rows, so only rows that already exist get them.
