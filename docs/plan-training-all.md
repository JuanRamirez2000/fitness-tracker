# Plan: All tab, all-activity charts, simpler summaries

Agreed 2026-11-11 and built the same day (steps 1–3 and the swim-ready work). Builds on Phase 1 (commit 026f530: All is the default Training filter, sport badges).

**Gear:** Garmin Enduro 4, HRM 200 strap, Wahoo Kickr Core 2. Heart rate is chest-strap quality in every sport, swims included. Every indoor ride has power.

## Step 1: All tab in three sections

**Shared: "Am I getting fitter overall?"** Each card has its own **All | Ride | Run** switch, set to All. The switch is built from the sport list. The loader already fetches every sport, so switching is instant: the server renders each variant, and a small client component shows one.

| Card | Plan | Why |
|---|---|---|
| VO2 max / fitness age | Shared, with switch | Garmin keeps one VO2 max per sport, so All draws a line for each; there is one fitness age |
| Training load (acute/chronic) | Shared, with switch | Garmin's number counts every sport. The per-sport views are new, built from each activity's `training_load` |
| Load focus | Shared, no switch | Garmin only gives the combined 4-week focus |
| HR zones | Shared, with switch | Each activity counts against its own sport's zones. Under All the bar label shows hours, not miles |
| Activity heatmap | Shared (as now) | Already colored by each day's main sport |
| Activities table | Shared, plus sport filter chips | Already has badges |

**Cycling section:** power curve, ride efficiency, FTP trend, and a **new power zones chart** (`power_zone_s` is stored but not shown anywhere yet).

**Running section:** race predictions, run efficiency, best efforts.

**Kept per sport:** anything built on power, FTP, watts per heartbeat, pace, race predictions or best efforts. Runs carry a running-power value too, so every power chart filters to rides first.

- A sport with nothing in the range folds into the one-line strip.
- The Ride and Run filters show their own sport's section plus the Shared cards with the switch locked to that sport.
- KPI row on All: total hours, load ratio, VO2 max for each sport, FTP.

## Step 2: new all-activity charts (Shared)

1. **Weekly volume by sport:** hours per week stacked by sport, with the weekly load as a line.
2. **Engine trend:** each sport's efficiency as % change from its own baseline, on one axis.
3. **What your sessions trained:** each week's sessions grouped by Garmin's training-effect label (Recovery, Base, Tempo, Threshold, VO2, Anaerobic), colored by sport.
4. **What each session cost you:** Body Battery drained against training load, one dot per session.

## Step 3: summaries

Every summary (Daily feel, Weight, Training, activity) follows the same shape, from the A + D weight drafts:

1. Where you stand, with one or two rounded numbers.
2. How that compares with your plan or your normal.
3. What it means for training or how you'll feel.
4. One concrete thing to do.

Guardrails:
- Four sentences.
- No fat or lean pounds, no HRV in ms, no lists of metrics.
- General fueling and recovery levers are allowed; diets, calorie targets and medical advice are not.

Prompt text says "rides, runs and swims". Facts are built per sport from the sport list.

## Swim-ready (swimming starts around January 2027)

Build now:
- One sport list in `lib/sport.ts` drives switches, badges, colors, sections, chart stacks and summary facts. Swim activity types: `lap_swimming`, `open_water_swimming`.
- Sports with no data are hidden from switches.
- A `--sport-swim` color token (violet, since blue is already "good" and the accent), contrast-checked in both themes.
- Hours as the cross-sport unit, since swim distance is in yards or meters.
- Sections come from config, so a Swimming section is one more entry.
- HR cards (zones, load, cost) include swims as is.

Wait for real swims:
- Swim charts: pace per 100 yd, SWOLF, stroke rate.
- Pool-length and stroke fields in the database.
- Per-100 splits in the activity window.

## Phases 2–4 (built 2026-11-11)

- **Phase 2, next workouts:** the plan lives in a Garmin Cycling Coach adaptive plan ("2027 Fitness Plan"). The unofficial import's `plan` dataset writes it to `planned_workouts` (migration 015): name, workout shorthand, estimated time, benefit, rest days, key sessions. The Training summary is a structured Gemini answer: 4 sentences plus 2–3 "Next up" sessions, explained in words, stored in `daily_summaries.next_sessions`. With no plan it suggests sessions instead.
- **Phase 3, Daily feel:** insight cards for recovery ("Ready for hard effort by …"), sleep, HRV and resting heart rate (`lib/insights/daily.ts`). The hero's factor bars became "What's helping / What's holding you back". KPI cards, charts and the calendar are folded behind "Show the numbers".
- **Phase 4, Weight:** insight cards for pace of loss, climbing at the same power (W/kg in the numbers) and one muscle verdict (`lib/insights/weight.ts`). The body fat KPI became "Climbing, same power". Body composition charts and the weigh-in log are folded.

**FTP note:** Garmin's FTP is now set to 222 W. The best 20-minute power on record is 138 W, from a steady zone 3 ride, not an all-out effort, so the true FTP is unknown. A ramp test on the Kickr would settle it.
