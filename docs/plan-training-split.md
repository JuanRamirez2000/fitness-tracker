# Plan: split the Training tab into quick, grouped views

Status: built 2026-11-17 (commit c160a2b). **This is the current layout**; the other plan docs
in this folder are history.

## Why

The Training tab is about **40 cards in 7 sections**: roughly 8,000 px tall on a laptop and 12,000 px on a phone (about 15 screens). The answer to "how am I doing?" is spread across all of it, and several cards answer the same question.

## Inventory: everything the app has

### What the Training tab shows today

| # | Section | What's in it |
| --- | --- | --- |
| – | Quick-look strip | Readiness, next session, each plan's goal number, this week's hours, load ratio, weight 7-day avg, sleep score + debt, race countdown |
| 01 | How's my week going? (week picker) | Weekly AI review (headline, wins, watch, next); load so far, readiness and mood, weight this week; In focus carousel: today's readiness, each plan (predicted 10K, VO2 max, easy pace, sessions done, ramp), plan vs done (7 days), records this week, hours by sport (12 wk), easy vs hard (8 wk); how you recovered (week mornings), how you felt (week mood) |
| 02 | What's next? | Training AI summary + next sessions; week planner (7 days, suggestions, forecast, plan a workout) |
| 03 | How am I recovering today? | Insight cards (HRV, resting HR, sleep, recovery); sleep score, sleep debt, steps |
| 04 | Am I getting fitter? (range + sport) | 5 KPI cards per sport (training time, ride/run miles, FTP, VO2 max ×2, load ratio, 5K prediction, easy pace); weekly volume by sport; VO2 max and fitness age; training load; load focus; time in HR zones; what your sessions trained; bricks; Body Battery; folded: sleep stages, mood chart |
| 05 | Cycling | Power curve + record rows; easy-ride efficiency; time in power zones |
| 06 | Running | Race predictions (5K to marathon); easy-run efficiency; best efforts |
| 07 | What did I do? | Activity calendar (training, steps modes); records feed; activities table |

The activity popup (any activity) also shows: route map, HR / pace / power / cadence graphs, splits, zones, cadence, stride, ground contact, vertical oscillation and ratio, temperature, Body Battery change, stamina, feel and effort (RPE), training effect, TSS, IF, normalized power, AI note.

### What the Weight tab shows

Quick-look strip; Weight AI summary; today's weight, 7-day avg, weekly rate, progress to goal, climbing at the same power, logging streak; pace and muscle insight cards; weight trend; goal projection; weekly loss vs plan; weight calendar; folded: weigh-in log.

### In the database but never shown

(The show/hide folds were removed on 11-17, so the sleep and mood charts and the weigh-in log are now always visible.)


- **Daily stress average.** It's stored but no view reads it.
- **Fitness age factors.** Only fitness age itself is charted.
- **Several kept-out cards.** HRV and resting HR charts, sleep timing, fat and lean mass, watts per kg, engine trend and session cost were taken off on 11-17, and their code deleted on 11-18 (git history has it). The recovery calendar came back on Recovery.

### Overlap: cards answering the same question

| Question | Cards that answer it now |
| --- | --- |
| How many hours am I training, by sport? | Hours by sport (week), weekly volume by sport (fitness), training time KPI, "this week" strip card |
| Am I training easy enough? | Easy vs hard, time in HR zones, load focus, what your sessions trained |
| Is my running getting better? | Plan card (predicted 10K, VO2 max, easy pace), race predictions, VO2 max chart, easy-run efficiency, 5K prediction KPI, easy-pace KPI |
| How much load, and is it too much? | Load so far, load ratio (strip + KPI), training load chart, ramp warning |
| Did I set records? | Records this week, records feed, best efforts, power curve rows |
| How recovered am I? | Strip readiness + sleep, today hero, insight cards, sleep KPIs, week recovery card, readiness and mood KPI, Body Battery |

## Decisions so far (11-17 Q&A)

- **Separate top-level tabs:** Home, Training, Recovery, Weight, Log.
- **The same shape on every tab**, all of it about that tab:
  1. Week so far: a row of small tiles.
  2. Swipeable section: In focus style.
  3. The rest: grouped tiles, then the full charts, all visible.
- **Planning lives on Home:** the planner, plan progress, plan vs done and the next session.
- **The quick-look strip goes.** Each tab's week-so-far row replaces it.
- **One week picker for every tab.** It sits in the header and drives each tab's week so far and swipeable section.
- **One range control per tab,** shared across tabs. It sits above that tab's charts and drives them.
- **Load focus goes.** Easy vs hard, time in HR zones and what sessions trained stay.
- **Running keeps all four charts** under its tile: race predictions, VO2 max and fitness age, easy-run efficiency, best efforts.
- **Hours:** Home's week so far shows this week's hours against 4–7 h. The 12-week chart lives only on Training (weekly volume), so the Home "Hours by sport" chart goes.
- **Records:** this week's on Home (swipeable section); the full feed on Log. Best efforts and the power curve stay on Training.
- **The recovery calendar comes back** on Recovery.
- **Log** is an overview of every kind of data the app has (it repeats other tabs on purpose):
  - Week so far: counts of what was logged this week.
  - Swipeable section: one view per data type showing which days have it.
  - The rest: a month grid with markers, the year heatmaps, a per-day table, the activities table, and the records feed.

## The plan

The URL changes to `?tab=home|training|recovery|weight|log`. Home opens first. Old links still work: `today` opens Recovery and `progress` opens Home.

### Home: is the plan on track this week?

- **Week so far:**
  - Hours against 4–7 h.
  - Sessions done of due (key sessions too).
  - Load against last week.
  - Next session.
- **Swipeable section:**
  - One view per plan (Runna: week X of 12, predicted 10K, VO2 max, easy pace, sessions, ramp).
  - Plan vs done (the 7 days).
  - Records this week.
- **The rest:**
  - The weekly AI review.
  - The training AI summary and next sessions.
  - The week planner (7 days, suggestions, forecast).

### Training: am I getting fitter?

- **Week so far:**
  - Hours by sport.
  - Run miles.
  - Ride hours.
  - Easy share.
  - Load ratio.
- **Swipeable section** (the picked week): easy vs hard, time in HR zones, what sessions trained, bricks.
- **The rest** (range control on top):

| Group | Tile | Charts under it |
| --- | --- | --- |
| Running | Predicted 10K, VO2 max, easy pace, miles | Race predictions, VO2 max and fitness age, easy-run efficiency, best efforts |
| Riding | FTP, best 20 min, cycling VO2 max, ride hours | Power curve, easy-ride efficiency, time in power zones |
| Load | Ratio, acute vs chronic, this week vs last | Training load, weekly volume by sport |
| Swimming | – | Placeholder until January |

The page-wide All / Ride / Run filter goes, because each sport has its own group. Shared charts keep their own small sport switch.

### Recovery: how recovered am I?

- **Week so far:**
  - Average readiness.
  - Average sleep score.
  - Sleep debt.
  - Average mood.
  - Average steps.
- **Swipeable section:**
  - Today's readiness and what drove it.
  - Last night's sleep.
  - How you recovered (the week's mornings).
  - How you felt (the week's mood).
- **The rest** (range control on top):
  - Insight cards.
  - Sleep stages.
  - Body Battery.
  - Mood chart.
  - The recovery calendar (year).

### Weight: is it coming off the right way?

- **Week so far:**
  - 7-day average and its change this week.
  - Weigh-ins this week.
  - Weekly rate against plan.
  - Progress to goal.
- **Swipeable section** (last 12 weeks, whatever the range): weight trend, goal projection, weekly loss vs plan.
- **The rest** (range control on top):
  - The weight AI summary.
  - Pace and muscle insights.
  - Today's weight, climbing at the same power, logging streak.
  - The weight calendar.
  - The weigh-in log.

### Log: what data is there?

- **Week so far:** activities, weigh-ins, mood logs, nights of sleep and readiness mornings logged this week.
- **Swipeable section:** one coverage view per data type, showing which days of the last 5 weeks have it.
- **The rest** (range control on top):
  - A month grid with markers (sport glyphs, weigh-in, mood, sleep). Clicking a day goes to its row.
  - The year heatmaps: training, steps, weight, readiness, sleep.
  - A per-day table: weight, readiness, sleep score and hours, HRV, resting HR, steps, Body Battery, mood, activities and load, planned vs done.
  - The activities table.
  - The records feed.

### Defaults (confirmed 11-17: filter dropped, swipeable ignores the range, AI calls as listed; "Build it")

- **Swipeable sections follow the picked week,** or a fixed 12 weeks for trends. They ignore the range control, which drives only the charts below.
- **AI calls stay within the free tier:**
  - Home: the weekly review and the training summary.
  - Weight: its summary.
  - Training, Recovery and Log: no new Gemini calls.
  - Refresh on Home rewrites the review and the training summary. On Weight it rewrites the weight summary. On the other tabs it only imports.
- **Week-so-far tiles:** two per row on a phone, one row on a laptop.
- **"On this page"** lists each tab's own sections.

### Build order

1. Tab plumbing:
   - Five tabs and the URL changes.
   - The week picker in the header; a range control per tab.
   - Loading per tab.
2. A shared week-so-far row and the tab skeleton: week so far, then the swipeable section, then the rest.
3. Home, then Training (tiles, and remove the sport filter), then Recovery, then Weight.
4. Log: the per-day table, the month grid, coverage views, and the moved heatmaps, activities table and records.
5. Refresh and summaries per tab. Check desktop and phone, then push.
