# Tracker

A personal training and weight dashboard for one athlete, fed by Garmin. Anyone with the link
can view it; an owner password unlocks editing, Refresh, logging and sending workouts to the
watch.

Four tabs, no carousels and nothing folded away (docs/plan-four-tabs.md). One week picker in the
header drives the week cards; each tab's charts sit under its own range control.

- **Home**: the next 7 days (suggestions, forecast, "Plan a workout"; a planned session opens
  its steps and notes, and today's done workouts open their review); today's readiness beside
  the week's training (time against the 4–7 h target, sessions done, load, the next session); key
  numbers for weight, sleep and fitness; the weight trend; then recovery: each morning and mood of
  the week, sleep, Body Battery and mood trends.
- **Training**: the next 7 days; key numbers beside easy vs hard (8 weeks); training load and
  volume; Running, Cycling and a swimming placeholder until January 2027.
- **Weight**: trend, then projection and weekly loss; the key numbers (7-day average, rate
  against plan, progress to goal); the weigh-in calendar and log, with Zepbound shots.
- **Log**: a month grid, the year heatmaps (the recovery calendar among them), every day's
  numbers, every activity and every record.

Clicking any activity opens it in a modal: route outline, HR / pace / power graphs, splits,
zones, running dynamics and an AI note.

## Stack

- **Next.js 16** (App Router, React 19, Server Actions) on **Vercel**
- **Postgres**: [Neon](https://neon.tech)'s free tier in production, via
  [`postgres`](https://github.com/porsager/postgres) (postgres.js).
  Locally, [PGlite](https://pglite.dev) runs the same Postgres inside Node,
  so there's nothing to install.
- **Auth**: none to view. `OWNER_PASSWORD` unlocks editing via a signed,
  HttpOnly cookie (`lib/auth/`). No user accounts.
- **Tailwind CSS v4**, **visx** for charts, **zod** for validation.
- **Gemini** (free tier, `gemini-3.6-flash`) for the AI text.
- **Python + GitHub Actions** for the parts of Garmin only the unofficial library reaches
  (`scripts/garmin/`).

The database is never reachable from the browser: pages read it in server
components, writes go through server actions (`app/actions.ts`), and each
action re-checks that the caller is the owner.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values it describes
npm run db:local             # terminal 1: local Postgres on port 5433
npm run db:import -- backups/<date>   # once: schema + your data (see below)
npm run dev                  # terminal 2: http://localhost:3000
```

### Database

`db/schema.sql` is the whole schema: `profiles` (one row, the owner), weigh-ins, shots, steps,
activities (with their detail, best efforts and AI notes), daily recovery, sleep and training
rows, planned workouts, mood logs, the AI activity notes (and the old daily and weekly summaries), the Garmin login cache, and
two views (`daily_weight`, `weight_trend`) that do the per-day and 7-day-average math in SQL.

`npm run db:import -- <folder>` applies that schema to an **empty**
database and loads a JSON export into it (the format of the Supabase export
in `backups/`, which is git-ignored). It reads `DATABASE_URL` from
`.env.local`, so point that at Neon to load production, or at PGlite to
load a local copy. It refuses to run if the tables already exist.

A database created before a schema change needs `npm run db:migrate`, which
applies every `db/migrations/*.sql` file. Each one is safe to re-run. `npm run db:migrate:prod`
does the same against Neon (`.env.local` holds both URLs; the npm scripts use the localhost one).

### Deploying (Vercel + Neon)

1. Create a Neon project (free tier). Copy its **pooled** connection string.
2. Load it once, from your machine:
   `DATABASE_URL='<neon url>' npx tsx scripts/db-import.ts backups/<date>`
3. In the Vercel project, set `DATABASE_URL`, `OWNER_PASSWORD`, `SESSION_SECRET`,
   `GARMIN_PERSONAL_ACCESS_TOKEN`, `CRON_SECRET`, `GEMINI_API_KEY` and (optional)
   `GITHUB_DISPATCH_TOKEN`, then redeploy.
4. In the GitHub repo's Actions secrets, set `DATABASE_URL` (the same Neon URL), `APP_URL`
   (the production site, no trailing slash) and `CRON_SECRET` (the same value as on Vercel).
5. Log in to Garmin once for the unofficial import: see `scripts/garmin/README.md`.

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest (pure logic, plus the API routes with their dependencies mocked)
npm run db:local     # PGlite Postgres server on :5433, data in .pglite/
npm run db:import -- backups/<date>   # schema + data into an empty DATABASE_URL
npm run db:migrate   # apply db/migrations/*.sql to an existing DATABASE_URL
npm run db:migrate:prod              # the same against Neon
npm run garmin:import -- --days 30   # Garmin backfill or dry run (see below)
npm run efforts:backfill             # best efforts for older runs
npm run workout -- week              # plan / send workouts (talks to production; see scripts/workout.ts)
```

## Real data from Garmin Connect

Two importers, because neither source has everything:

- `lib/garmin/` (TypeScript) imports weigh-ins, steps, activities and their detail, sleep,
  recovery and fitness age through Garmin's official [Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api/).
- `scripts/garmin/` (Python, GitHub Actions) imports training readiness, training status and
  load, race predictions, VO2 max, FTP and the plan on the Garmin calendar (Runna, Garmin Coach,
  any app's) with the unofficial `python-garminconnect` library, and pushes the tracker's own
  workouts to that calendar. Setup: `scripts/garmin/README.md`.

**Setup:** in Garmin Connect Web, open the Personal API Key page, create a key
(it expires after 30 days to 1 year; Garmin emails a week before), and set it
as `GARMIN_PERSONAL_ACCESS_TOKEN` in `.env.local` and in Vercel. The importer
swaps it for a 24-hour bearer token on its own.

### Schedule

| When (UTC) | What | Where |
| --- | --- | --- |
| 09:00 | Personal API import of yesterday | Vercel Cron → `/api/garmin/cron` |
| 15:30 | Unofficial import (readiness, load, plan), queued workouts out, then the morning job: today's sleep and recovery, notes for new activities | GitHub Actions (`garmin-unofficial.yml`) → `/api/summary/cron?after=import` |
| 17:15 | Fallback morning job: imports only if this morning's readiness isn't in yet, then any missing activity notes | Vercel Cron → `/api/summary/cron` |
| 05:30 | Unofficial import after the day's workouts, queued workouts out | GitHub Actions |
| on demand | "Send to watch" pushes a workout straight away (needs `GITHUB_DISPATCH_TOKEN`; otherwise it waits for the next run above) | GitHub Actions (`garmin-push.yml`) |

The morning job waits on the GitHub run because GitHub often starts scheduled runs 10–60 minutes
late. The Personal API key expires after
30 days to 1 year; the Refresh button says so when it has.

- **On demand**: the dashboard's "Refresh" button (owner only) imports today and reloads.
- **By hand**: `npm run garmin:import` with `--yesterday`, `--days N`,
  `--since YYYY-MM-DD`, `--only weigh-ins|steps|activities` (repeatable) and
  `--dry-run`. Default is the last 7 days. Use `--only` for any backfill
  reaching before the program's start, since an older weigh-in would move the
  start weight.
- Everything writes `source = 'garmin'` rows, keyed by Garmin's own per-record
  ID (steps by day), so any window is safe to re-run.

## AI text

Gemini's free tier allows about 20 calls a day. The only AI text is the note on each activity: a
normal day spends one per new activity in the morning job, and opening an older activity without
a note spends one. The dashboard's daily and weekly summaries were dropped on 2026-11-24. Viewers who aren't the owner never
trigger a call. Free-tier prompts may be used by Google to improve its products.

## Project structure

```
app/
  page.tsx                 The dashboard shell: header, tabs, the open tab
  actions.ts               Server actions: weigh-ins, settings, shots, mood, workouts
  login/                   Owner password to unlock editing
  api/garmin/refresh/      Imports today from Garmin (the Refresh button)
  api/garmin/cron/         Nightly Personal API import (Vercel Cron)
  api/summary/cron/        The morning job (GitHub run, Vercel fallback)
  api/activity/[id]/       The activity modal's data and AI note
components/
  tabs/                    One file per tab
  dashboard/ charts/ heatmap/ progress/ log/ workouts/ activity/ ui/
lib/
  auth/                    Session tokens, cookie, sign-in/out
  data/                    zod schemas; queries.ts holds most SQL
  db.ts                    The Postgres connection pool
  garmin/                  Personal API client, row mapping and importer
  kpis/ charts/ heatmap/ progress/ dashboard/   Pure, unit-tested data shaping
  summary/                 The Gemini call and the activity note's prompt
  workouts/                Planner, suggestions, workout builder, Garmin push queue
  dates/ range/            Timezone-safe local dates, the range and week pickers
db/schema.sql              The whole database schema
db/migrations/             Changes to apply to a database made before them
scripts/                   Import, migrate and workout CLIs; garmin/ is the Python half
docs/                      Garmin field notes and the plans each layout was built from
```

## Design principles this codebase follows

- **`local_date` is never derived from a UTC timestamp.** Every
  timezone-sensitive calculation goes through `lib/dates/timezone.ts`,
  which converts through `Intl.DateTimeFormat` so DST is always correct.
- **Pure logic, dumb components.** Anything that shapes data for the UI
  (a KPI's `compute()`, the heatmap's `toCells()`, a chart's `build*()`)
  is a plain, unit-tested function; components only turn that output into
  pixels.
- **Adding a KPI card is one new file + one line** in `dashboard.config.ts`.
