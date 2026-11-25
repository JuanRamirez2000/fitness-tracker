# Plan: four tabs, Recovery folds into Home, no carousels, no AI summaries on the page

Status: built 2026-11-24. Replaces the five-tab layout (`docs/plan-training-split.md`)
and the carousel and week-strip parts of `docs/plan-home-and-header.md`. That doc's phone header is
built separately (step 0 below).

Tabs: **Home, Training, Weight, Log.** `?tab=recovery` (and an old `recovery` saved in
localStorage) opens Home.

Every tab drops its "This week so far" strip and its carousel. The header keeps the week picker.

## Home

1. **Next 7 days**, full width: the planner with Plan a workout and Send to watch. It always runs
   from today onward, whatever week is picked. The mileage ramp warning sits above it when it fires.
2. **Readiness | This week's training**, side by side:
   - Readiness: today's ring and what's helping or holding you back (the old Recovery "Today" card).
   - This week's training: time, sessions done, load and the next session. On a past week, that
     week's totals.
3. **Key metrics**: 7-day average, rate vs plan, progress to goal, sleep score, sleep debt, 10K
   prediction, running VO2 max.
4. **Weight trend**, full width: 12 weeks to the picked week's end, linking to the Weight tab.
5. **Recovery**, with the range control in the section heading:
   - How you recovered (each morning) | How you felt (Log feel), for the picked week.
   - Sleep, Body Battery and mood trend charts, driven by the range.

**What goes:**
- Plan vs done.
- The Runna and other plan progress cards.
- The week's records (they stay on Log).
- The training summary and its "Next up".
- The weekly review.
- The recovery insight cards.
- The Recovery tab's sleep week chart.

## Training

1. **Next 7 days** (the same card as on Home).
2. **Metrics + easy vs hard**, with the range control in this heading:
   - Load ratio, training hours, weekly miles, FTP, cycling VO2 max. Swim hours join once swims sync.
   - **Easy vs hard** becomes a small card. It shows a column per week for the 8 weeks to the picked
     week, each split into easy (bottom) and hard (top), with a line at 80% easy.
3. **How much am I training?**: training load (with the sport switch) and weekly volume.
4. **Running**: race predictions, efficiency, VO2 max, best efforts. Charts only, no tiles.
5. **Cycling**: power curve, efficiency, power zones. Charts only.
6. **Swimming**: placeholder until January.

**What goes:**
- The This-week strip.
- The carousel's HR zones, sessions trained and bricks.
- The per-sport tile rows (10K, running VO2 max and easy pace leave Training; the first two are on Home).

## Weight

1. **Trend**, full width.
2. **Projection | Weekly loss.**
3. **Where am I today?**: the key-number cards, with the range control.
4. **What did I log?**: the weigh-in calendar and table.

**What goes:**
- The carousel.
- The AI weight summary.
- The weight insight cards (pace, muscle).

## Log

The coverage carousel and the This-week strip go, so Log opens on the calendar. The recovery
calendar is already here. Everything else stays.

## AI calls

The morning job and Refresh stop writing the training summary, the weight summary and the weekly
review. That frees 3 of the 20 free Gemini calls a day. Per-activity summaries keep going. Stored
rows stay in the database.

The cron's "already written today" check keys off the training summary, so it needs a new signal,
such as today's recovery row being imported.

## Build order

0. Finish the phone header in progress (`header-menu.tsx`, the Refresh button changes). Check it at
   phone width and commit it on its own.
1. Drop the Recovery tab: tab key, URL and localStorage redirect, skeletons, "On this page".
2. Rebuild Home.
3. Rebuild Training, including the new easy vs hard card.
4. Weight and Log.
5. Stop the summaries: cron, Refresh, data loading.
6. Delete what nothing imports any more, then update the README and these docs.
7. Check phone and desktop in both themes, then push to main.
