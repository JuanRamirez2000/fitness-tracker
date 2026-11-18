# Plan: Progress tab, weekly review, mood log, bricks

Agreed with the owner 2026-11-16 (Q&A in session). Not built yet. Priorities: Progress tab +
weekly review + mood log high, brick card a quick add. Records feed (medium), race checklist
(February 2027) and "plan my week" (backup to Stamina) are out of scope here.

## Decisions

| Area | Decision |
|---|---|
| New tab | **Progress**, a fourth tab after Training (`?tab=progress`) |
| Week | Monday–Sunday, `← Week of Nov 10 →` picker, `?week=YYYY-MM-DD` (the Monday); stops at the current week |
| Review timing | Full review **Monday morning** with the existing 7:45 am summary run (Sunday's late session, sleep and HRV are in by then). Tue–Sun: a **"week so far"** note refreshed in the same morning run |
| Review content | Training vs plan, recovery trend, next week preview, backed by the mood log. **No weight** |
| Review style | **Short sections**: Wins / Watch out / Next week, 1–2 lines each, plus a one-line headline (used in the email) |
| Top cards | Load vs last week (flag a jump over ~15%), Avg readiness + mood, plus Countdown + phase to fill the six-unit row |
| Tri progress (light) | Countdown + phase, weekly hours by sport against the 4–7 h band. Checklist waits for February |
| Mood log | Mood, energy, soreness (+ body areas), motivation, sick and injured toggles. **1–5 taps**, **once a day**, editable. No free-text note |
| Log button | App header on every tab, with a dot until today is logged. `?log=1` opens the modal (email link target) |
| Mood data used in | Daily feel AI summary, markers on charts (sick/injured days), weekly review. Chart on **both** Daily feel (long-term) and Progress (the week's 7 days) |
| Emails | Resend free tier. **7 pm daily**: 2–3 line recap (today's training, readiness, sleep) + "Log how you feel" button, or "Logged ✓ – edit". **Monday**: review headline + button to the Progress tab |
| Phone push | Later, only if email gets ignored (web push or ntfy, both free) |
| Brick rule | Run starts ≤ 15 min after a ride ends, indoor or outdoor; Garmin multisport activities count too |
| Brick card | On Training: off-bike pace vs fresh runs at the same heart rate, and first-mile drop-off over time |

## Data

Migration 017:

```sql
create table mood_logs (
  user_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  sore_areas text[] not null default '{}',   -- legs | hips | back | shoulders | arms
  motivation smallint check (motivation between 1 and 5),
  sick boolean not null default false,
  injured boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table weekly_summaries (
  user_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,                  -- the Monday
  final boolean not null default false,      -- false = "week so far"
  headline text not null,
  sections jsonb not null,                   -- {wins: [], watch: [], next: []}
  model text,
  generated_at timestamptz not null default now(),
  emailed_at timestamptz,
  primary key (user_id, week_start)
);
```

Every question is optional, so a quick "sick today" log is fine. Body-area chips show only when
soreness is 3 or more.

## Build order

1. **Mood log.** Migration, server action (upsert today's row), modal (five rows of 1–5 taps,
   area chips, two toggles), header button + dot, `?log=1`. Daily feel: mood/energy chart under
   "Show the numbers"; yesterday's and today's log in the Daily feel summary facts. Sick/injured
   days drawn as markers on the recovery and training charts.
2. **Brick card** (Training tab, hidden until the first brick). `lib/charts/bricks.ts` pairs
   ride → run by the 15-min gap (plus multisport parents, to be checked against a real one).
   Off-bike cost: the run's speed per heartbeat vs the median of fresh runs in the last 90 days
   within ±10 bpm (±5 over 60 days left both real bricks without enough runs). **Built 11-17.** First-mile drop: first mile vs the rest from `mile_splits`; runs under 1.5 mi
   use the first 5 minutes vs the rest from the series. Activity and weekly summaries name a
   brick as one.
3. **Progress tab, numbers.** `TAB_KEYS` + label, week picker, the three top cards, hours by sport
   (stacked bars, last 12 weeks ending on the chosen week, 4–7 h band), a Mon–Sun strip of
   planned vs done (`planned_workouts` vs activities: done / missed / swapped), the week's
   recovery (sleep, HRV, readiness per day) and the week's mood log. **Built 11-17**
   (lib/progress/): the current week's load compares with the same days of last week; a
   planned session counts as done another day when the same sport happens within two days.
4. **Weekly review.** `lib/summary/weekly.ts`: facts for the week (+ the week before for
   comparison, next week's planned sessions), Gemini structured output → `weekly_summaries`.
   The morning cron writes "so far" Tue–Sun and the final one on Monday for the week before.
   Refresh on the Progress tab rewrites the current week. Same rules as the other summaries:
   plain words, effect + what to do, no HRV-ms numbers. **Built 11-17** (migration 018): Refresh
   rewrites only the weekly review on Progress and only the tab summaries elsewhere, because
   the free tier allows 20 calls a day for gemini-3.6-flash. `npm run summary:generate -- --weekly`.
5. **Emails.** `lib/email/` with Resend (`RESEND_API_KEY`), from `onboarding@resend.dev` to the
   owner's own address (no domain needed). Monday teaser goes out after step 4's final review
   (set `emailed_at` so a retry doesn't send twice). New cron at ~7 pm local: import today's
   activities first (the nightly import hasn't run yet), then send the recap.

## Notes and risks

- **Resend account:** the owner creates it and adds the key to Vercel. Free tier: 3,000 emails/month, 100/day; this uses about 35/month.
  Free fallback with no new account: Gmail SMTP with an app password.
- **Cron timing:** Vercel Hobby crons run once a day and may fire anywhere in the scheduled hour,
  in UTC: 7 pm PT is `0 3 * * *` in winter and shifts by an hour with daylight saving.
- **Email links** open the site; an expired session goes through login and then back to `?log=1`.
- **Multisport bricks:** how the Personal API returns a multisport activity (one parent or separate
  children) is unknown until one is recorded; timing-based pairing works either way.
- **Stamina:** when it replaces Garmin Coach, its workouts arrive through the Garmin calendar
  into `planned_workouts`, so the plan strip and "Next week" keep working; this tab becomes
  the week overview the owner wants for Stamina weeks.
