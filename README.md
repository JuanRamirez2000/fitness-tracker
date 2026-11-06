# Tracker

A weight tracker for one person. Anyone with the link can view it; an
owner password unlocks editing. Five numbers across the
top, a year-long heatmap of daily weight change with a ★ for each Zepbound
shot, a few trend charts (including daily steps against a 10k line), and a
table of every weigh-in shaded the same way as the heatmap.

## Stack

- **Next.js 16** (App Router, React 19, Server Actions)
- **Postgres**: [Neon](https://neon.tech)'s free tier in production, via
  [`postgres`](https://github.com/porsager/postgres) (postgres.js).
  Locally, [PGlite](https://pglite.dev) runs the same Postgres inside Node,
  so there's nothing to install.
- **Auth**: none to view. `OWNER_PASSWORD` unlocks editing via a signed,
  HttpOnly cookie (`lib/auth/`). No user accounts.
- **Tailwind CSS v4**, **visx** for charts, **zod** for validation.

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

`db/schema.sql` is the whole schema: `profiles` (one row, the owner),
`weigh_ins`, `injections` (shots), `daily_steps`, `activities`, and two views (`daily_weight`,
`weight_trend`) that do the per-day and 7-day-average math in SQL.

`npm run db:import -- <folder>` applies that schema to an **empty**
database and loads a JSON export into it (the format of the Supabase export
in `backups/`, which is git-ignored). It reads `DATABASE_URL` from
`.env.local`, so point that at Neon to load production, or at PGlite to
load a local copy. It refuses to run if the tables already exist.

A database created before a schema change needs `npm run db:migrate`, which
applies every `db/migrations/*.sql` file. Each one is safe to re-run.

### Deploying (Vercel + Neon)

1. Create a Neon project (free tier). Copy its **pooled** connection string.
2. Load it once, from your machine:
   `DATABASE_URL='<neon url>' npx tsx scripts/db-import.ts backups/<date>`
3. In the Vercel project, set `DATABASE_URL`, `OWNER_PASSWORD`,
   `SESSION_SECRET`, `GARMIN_PERSONAL_ACCESS_TOKEN` and `CRON_SECRET`, then
   redeploy.

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest (pure logic: KPIs, heatmap, charts, dates, auth tokens)
npm run db:local     # PGlite Postgres server on :5433, data in .pglite/
npm run db:import -- backups/<date>   # schema + data into an empty DATABASE_URL
npm run db:migrate   # apply db/migrations/*.sql to an existing DATABASE_URL
npm run garmin:import -- --days 30   # Garmin backfill or dry run (see below)
```

## Real data from Garmin Connect

`lib/garmin/` imports weigh-ins, daily steps and activities through Garmin's
official [Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api/).

**Setup:** in Garmin Connect Web, open the Personal API Key page, create a key
(it expires after 30 days to 1 year; Garmin emails a week before), and set it
as `GARMIN_PERSONAL_ACCESS_TOKEN` in `.env.local` and in Vercel. The importer
swaps it for a 24-hour bearer token on its own. When the key expires, the
Refresh button says so; create a new key and replace the variable.

- **Nightly**: Vercel Cron (`vercel.json`) calls `/api/garmin/cron` at 09:00 UTC,
  which imports yesterday in the profile's timezone. Needs `CRON_SECRET` set on
  the Vercel project.
- **On demand**: the dashboard's "Refresh" button (owner only) imports today, then rewrites
  today's AI summaries.
- **By hand**: `npm run garmin:import` with `--yesterday`, `--days N`,
  `--since YYYY-MM-DD`, `--only weigh-ins|steps|activities` (repeatable) and
  `--dry-run`. Default is the last 7 days. Use `--only` for any backfill
  reaching before the program's start, since an older weigh-in would move the
  start weight.
- Everything writes `source = 'garmin'` rows, keyed by Garmin's own per-record
  ID (steps by day), so any window is safe to re-run.

## Project structure

```
app/
  page.tsx                 The dashboard: cards, heatmap, charts, table
  actions.ts               Server actions: add/edit/delete weigh-ins, settings
  login/                   Owner password to unlock editing
  api/garmin/refresh/      Imports today from Garmin (the Refresh button, step one)
  api/summary/refresh/     Rewrites today's AI summaries (the Refresh button, step two)
  api/garmin/cron/         Nightly Garmin import (Vercel Cron)
components/                UI (dashboard/, heatmap/, charts/, ui/)
lib/
  auth/                    Session tokens, cookie, sign-in/out
  data/                    zod schemas; queries.ts holds every SQL query
  db.ts                    The Postgres connection pool
  garmin/                  Garmin Personal API client, row mapping and importer
  kpis/  heatmap/  charts/ Pure, unit-tested data shaping for each section
  shots/                   Lines shots up with the weekly schedule (taken / scheduled / missed)
  dates/  range/           Timezone-safe local dates and the range picker
db/schema.sql              The whole database schema
db/migrations/             Changes to apply to a database made before them
scripts/db-import.ts       Loads an export into an empty database
scripts/garmin-import.ts   Garmin import from the command line
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
