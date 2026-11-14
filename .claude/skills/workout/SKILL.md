---
name: workout
description: Plan a run, ride or swim (or the week's supplemental sessions) around the athlete's Garmin Coach plan and send it to their Garmin watch. Use when they say "/workout", "plan a run/swim/ride", "give me a workout", "what should I do Sunday", "plan my week", or ask for a session for the triathlon.
---

# /workout: plan a workout and send it to the watch

The tracker builds structured workouts (lib/workouts/) for the sports the Garmin Coach plan isn't
covering, and sends them to the Garmin calendar so they reach the Enduro 3 on its next sync.
It's the same builder as the Training tab's "Plan a workout" modal, so a workout planned here
looks the same on the website.

Everything goes through `npm run -s workout -- <command>` (scripts/workout.ts). It talks to the
**production** database by default (the website and the watch read it); never pass `--local`
unless asked. Don't print database URLs or tokens.

## Context worth knowing

- A race: Cal Tri Lake Perris Sprint, Sun 2027-04-11 (400 yd open-water swim, 9.2 mi bike,
  3.1 mi run). The planner counts phases from it: base, build (last 14 weeks), taper (last 13 days).
- One Garmin Coach plan owns one sport at a time (cycling as of Nov 2026). The tracker supplements
  the others, within a 7 h/week limit that includes the Coach sessions.
- Swimming: 25-yard pool, Sundays for now; they couldn't swim a length in Nov 2026. The swim
  templates unlock by "swim stage" (0–4), which they set; ask before raising it.
- Bike: power targets come from their FTP (an estimate from their best 20 minutes unless set) and
  the watch holds them in ERG on the Kickr. Garmin's own FTP has been far too high.

## Steps

1. **Read the week.** `npm run -s workout -- week --json`. Note `coached_sports`, each day's Coach
   sessions and own workouts, `suggestions` (each has sport, date, kind, effort, minutes, why),
   `planned_hours_next_7_days` against `weekly_hour_limit`, and the phase.

2. **Ask at most two questions** with AskUserQuestion, skipping any they already answered:
   - **When** (and which sport, if they didn't say): options are the suggested days first
     ("Sun Nov 15: swim, the suggested day"), then other free or easy days. Mention key Coach
     days and rest days in the option descriptions.
   - **How hard**: Easy (effort 2), Steady (3), Hard (4). Recovery (1) and Very hard (5) only if
     they ask. Put the suggestion's effort first, marked (Recommended).
   For "plan my week", ask one multi-select question instead: which of the suggestions to add.

3. **Preview.** `npm run -s workout -- preview --sport <ride|run|swim> --date <YYYY-MM-DD> --effort <1-5> [--kind <kind>] [--minutes <n>] --json`.
   Kinds: run recovery, easy, strides, tempo, hills, intervals, long, brick · ride recovery,
   endurance, cadence, tempo, sweetspot, threshold, vo2, outdoor · swim skills, build,
   endurance, race (by swim stage). Leave `--kind` out ("auto") unless they asked for one.
   Show them the name, length and steps as a short list, plus every warning.

4. **Send.** If there are no warnings, or they've already OK'd them, run the same arguments with
   `plan ... --send`. With warnings they haven't seen, ask once before sending (offer "Send anyway"
   or an easier/shorter version). It prints the new workout's id and the Garmin result.

5. **Report** in two or three lines: what's on which day, that it's on their Garmin calendar, and
   that it appears on the watch after its next sync (open the Garmin Connect app to sync now).
   If the push failed, say so with the error; the workout stays saved and they can retry from the
   Training tab or with `npm run -s workout -- send --id <id>`.

## Other commands

- `npm run -s workout -- remove --id <id>`: takes a workout off the plan and the Garmin calendar.
- `npm run -s workout -- send --id <id>`: sends a saved draft, or retries a failed send.
- `npm run -s workout -- settings --swim-stage <0-4>` / `--ftp <watts|auto>`: the builder's
  settings (also editable in the modal). Swim stages: 0 can't swim a length, 1 one or two
  lengths, 2 100 yd, 3 200+ yd, 4 400 yd nonstop.

## Rules

- Don't plan anything hard on, or the day before, a key Coach session, and keep at least one
  day a week fully off. The warnings catch these; take them seriously.
- Coached sports: only add a session there if they ask (it adds to the Coach plan's load).
- Never edit or delete Garmin Coach sessions; this only manages the tracker's own workouts.
