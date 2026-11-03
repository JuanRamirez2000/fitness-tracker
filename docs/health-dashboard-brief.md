# Health dashboard: data plan and design brief

Status: planning. Phase 1 (runs, efficiency, weekly miles, VO2 max) is live. This covers the
next batch and the redesign that should come before it is built.

## Metrics in scope

| Metric | Garmin source (python-garminconnect) | Fields | Stored as |
|---|---|---|---|
| Time in HR zones | activity list (already pulled) | `hrTimeInZone_1..5` (seconds) | 5 new columns on `activities` |
| Training load | `get_training_status(date)` | acute load, chronic load, chronic band min/max, ACWR + status (OPTIMAL...), training status + phrase (PRODUCTIVE...), monthly load focus: aerobic low / aerobic high / anaerobic with target ranges; per-run `activityTrainingLoad` (stored) | `daily_health` |
| Race predictions | `get_race_predictions()` (has a daily range form) | 5K, 10K, half, marathon (seconds) | `daily_health` |
| Recovery time | `get_training_readiness(date)` | `recoveryTime` (minutes) | `daily_health` |
| Training readiness | `get_training_readiness(date)` | score 0-100, level, factor % + feedback for sleep, sleep history, recovery time, ACWR, HRV, stress history | `daily_health` |
| Sleep | `get_sleep_data(date)` | total, deep/light/REM/awake seconds, score, start/end (local), sleep need, avg sleep stress, restless moments | `daily_health` |
| Resting HR | `get_stats(date)` | `restingHeartRate`, `lastSevenDaysAvgRestingHeartRate` | `daily_health` |
| HRV | `get_hrv_data(date)` | last-night avg, weekly avg, status, baseline band (balancedLow/Upper) | `daily_health` |
| Body Battery | `get_stats(date)` | at wake, high, low, charged, drained | `daily_health` |
| Fitness age | `get_fitnessage_data(date)` | fitness age, achievable age, components (body fat, vigorous days/min, RHR) with targets | `daily_health` |
| Body composition | `get_body_composition(start, end)` (already pulled for weight) | body fat %, muscle mass, body water %, bone mass, BMI | new columns on `weigh_ins` |

Derived in the app, not stored: fat mass and lean mass (weight x body fat %), weekly zone
split (% easy vs hard), sleep debt against sleep need, bedtime consistency.

Deferred: overnight SpO2, running form (cadence and stride are stored already; power,
vertical oscillation and GCT later), endurance and hill score, intensity minutes.
Dropped: calories burned, fastest mile, the fixed month/6M/year weight panels.
Later: an AI summary at the top of the page.

## Import cost

About 6 extra Garmin calls per night (stats, sleep, HRV, readiness, training status, fitness
age; race predictions by range). Backfill is one call per day per endpoint, so it is paced
and limited to program start (Sep 10, 2026) at first, roughly 330 calls; older history can
follow in batches. Garmin already rate-limited one login, so this matters.

## Sample data (real, Oct 26 - Nov 2, 2026)

| Date | RHR | HRV | Sleep | Score | BB wake | Stress | Run |
|---|---|---|---|---|---|---|---|
| Oct 26 | 52 | 43 | 5.9h | 82 | 76 | 25 | 2.75 mi run-walk, 131 bpm |
| Oct 27 | 50 | 46 | 6.8h | 87 | 80 | 29 | 1.87 mi run-walk |
| Oct 28 | 51 | 43 | 4.1h | 62 | 52 | 26 | rest |
| Oct 29 | 52 | 41 | 5.8h | 83 | 64 | 28 | 3.03 mi threshold, 159 bpm |
| Oct 30 | 51 | 42 | 4.9h | 70 | 52 | 28 | rest |
| Oct 31 | 52 | 42 | 3.8h | 57 | 43 | 29 | rest |
| Nov 1 | 51 | 44 | 5.0h | 72 | 59 | 31 | 2.08 mi run-walk |
| Nov 2 | 52 | 43 | 5.8h | 79 | 61 | 24 | 2.05 mi run-walk |

Today: readiness 58 (moderate; sleep history 50%, HRV 100%, recovery 80%, ACWR 87%),
recovery time 12.6 h, acute load 173 vs chronic 160 (band 128-240, ACWR 1.0, optimal),
training status productive, monthly load focus above targets (aerobic low 301, aerobic high
366, anaerobic 0), HRV 43 balanced (band 40-50), RHR 52, VO2 max 41.9, fitness age 27.1
(real age 26, achievable 18), race predictions 5K 29:13 / 10K 1:03:57 / half 2:28:55,
body fat 33.7%, muscle 99.7 lb, body water 48.4%, weight 274.3 lb (7-day avg 272.7, goal
200, start 288), 9.0 run miles this week, easy pace at 130 bpm 14:26/mi.

## Claude Design prompt

Copy everything in the block below into Claude Design.

```text
Design a personal health and running dashboard for one athlete (a single-page web app,
desktop first, must also work at 375px phone width). It is public to view; only the owner
edits. It currently tracks weight loss on Zepbound (weekly shots), daily steps and runs, and
is about to add recovery, sleep, training load and body composition from a Garmin Enduro 3
and Index scale. Every chart follows one range control at the top: Week, Month, 6 months,
Year, All time, Custom.

Please produce three variants of the full page, each in a different design system or visual
direction, so I can compare them side by side:
  A. Refined version of the current look: dark, editorial, calm. Serif section titles
     (Newsreader), IBM Plex Sans for UI, IBM Plex Mono for numbers and labels, soft blue
     accent, coral for bad, muted slate cards on near-black, plus a warm off-white light mode.
  B. Bright and friendly health app: light first, rounded cards, generous whitespace, one
     color per domain (weight, running, recovery, sleep, body) used consistently.
  C. Dense athletic data terminal: dark, compact, high information density, monospace
     numerals, thin rules instead of card borders, small multiples.
If you have saved design systems available, use them for B and C instead and say which.

The page should answer four questions at a glance, in this order:
  1. How am I doing today? (readiness, recovery, last night's sleep)
  2. Am I losing fat, not muscle? (weight trend, body composition)
  3. Am I training at the right effort and load? (zones, load, readiness)
  4. Am I getting fitter and faster? (easy-run efficiency, VO2 max, race predictions, fitness age)

Sections and content (group, merge or reorder if it reads better; propose a grid):
- Top: a slot for a short AI-written daily summary (2-3 sentences), then a "Today" hero:
  training readiness score 0-100 with its six contributing factors, recovery time remaining,
  last night's sleep, Body Battery at wake.
- KPI cards (existing, keep): today's weight, 7-day average, weekly rate, progress to goal,
  logging streak, steps, run miles (7 days), easy pace @ 130 bpm, VO2 max. Each card has a
  label, a big number, a small delta chip, and a sparkline or progress bar.
- Weight and body:
  - Weight trend (existing flagship chart): raw daily dots, 7-day average line and area, goal
    line, pace line, program-start marker, shot stars under the axis, run tick marks.
  - Body composition over time: fat mass vs lean mass as a stacked area or multi-series
    line, plus a current-snapshot donut (fat / muscle / bone / water). Body fat 33.7%.
  - Weight heatmap (existing): a year of day cells colored by daily change.
- Running and training:
  - Time in HR zones: weekly stacked bars (zones 1-5), with the share of easy (z1-2) called out.
  - Training load: acute vs chronic load over time with the optimal chronic band shaded,
    ACWR and Garmin's training status (productive / maintaining / overreaching...), and
    monthly load focus (aerobic low / aerobic high / anaerobic) against target ranges.
  - Running volume (existing): miles per day or week.
  - Easy-run efficiency (existing): each easy run's pace scaled to 130 bpm plus a 5-run trend.
  - Race predictions over time: 5K, 10K, half marathon.
  - Fitness age vs real age, with what would lower it (body fat is the top lever).
  - Runs table (existing): date, easy/workout, distance, time, pace, avg HR, cadence, effect.
- Recovery and sleep:
  - Sleep: nightly stacked bars (deep / REM / light / awake) against a sleep-need line,
    bedtime dots, sleep score.
  - Resting HR and HRV trends, HRV drawn inside its personal normal band (40-50 ms).
  - Body Battery: daily high/low range bars with the wake value marked.
- Activity heatmap (existing): a year of day cells with a Steps / Running toggle.
- Weigh-ins table (existing, owner can add/edit/delete and mark shot days).

Use this real data so the mockups feel true (Oct 26 - Nov 2, 2026):
  Date    RHR HRV Sleep Score BB@wake Stress Run
  Oct 26  52  43  5.9h  82    76      25     2.75 mi run-walk, 131 bpm
  Oct 27  50  46  6.8h  87    80      29     1.87 mi run-walk
  Oct 28  51  43  4.1h  62    52      26     rest
  Oct 29  52  41  5.8h  83    64      28     3.03 mi threshold, 159 bpm
  Oct 30  51  42  4.9h  70    52      28     rest
  Oct 31  52  42  3.8h  57    43      29     rest
  Nov 1   51  44  5.0h  72    59      31     2.08 mi run-walk
  Nov 2   52  43  5.8h  79    61      24     2.05 mi run-walk
Today: readiness 58 (moderate; sleep history 50%, HRV 100%, recovery 80%, ACWR 87%, stress
history 87%, sleep 68%), recovery 12.6 h, acute load 173 vs chronic 160 (optimal band
128-240), status productive, load focus above targets (aerobic low 301, aerobic high 366,
anaerobic 0), sleep need 8 h, VO2 max 41.9, fitness age 27.1 (age 26, achievable 18), race
predictions 5K 29:13 / 10K 1:03:57 / half 2:28:55, body fat 33.7%, muscle 99.7 lb, body
water 48.4%, weight 274.3 lb (7-day avg 272.7, start 288, goal 200, 17% of the way), steps
10,025 (goal 10k), run miles 9.0 this week, easy pace @ 130 bpm 14:26/mi (1:11 faster than
the prior 4 weeks), 3 Zepbound shots logged.

Constraints: charts must stay readable in both dark and light themes; numbers use tabular
figures; color is never the only signal (pair with labels or shape); keep the page scannable
top to bottom on a phone. Note any chart you think is redundant or should be cut.
```
