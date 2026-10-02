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
`weigh_ins`, `injections` (shots), `daily_steps`, `garmin_token_cache`, and two views (`daily_weight`,
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
   and `SESSION_SECRET`, then redeploy.
4. In the GitHub repo's Actions secrets, add `DATABASE_URL` for the nightly
   Garmin job (and delete the old `SUPABASE_*` / `GARMIN_IMPORT_USER_ID`
   secrets).

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
```

## Real data from Garmin Connect

`scripts/garmin/` is a separate Python project (its own venv) that imports
weigh-ins and daily steps from Garmin Connect via the unofficial
[`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
library. See `scripts/garmin/README.md` for setup, and
`.github/workflows/garmin-nightly.yml` for the nightly cloud job.

- **Nightly**, automatically, in GitHub Actions: yesterday's weigh-ins and steps.
- **On demand**: the dashboard's "Refresh" button (owner only) pulls today.
- Both write `source = 'garmin'` rows, keyed by Garmin's own per-record ID,
  so any window is safe to re-run.

## Project structure

```
app/
  page.tsx                 The dashboard: cards, heatmap, charts, table
  actions.ts               Server actions: add/edit/delete weigh-ins, settings
  login/                   Owner password to unlock editing
  api/garmin/refresh/      Dispatches the Garmin GitHub Actions job on demand
components/                UI (dashboard/, heatmap/, charts/, ui/)
lib/
  auth/                    Session tokens, cookie, sign-in/out
  data/                    zod schemas; queries.ts holds every SQL query
  db.ts                    The Postgres connection pool
  kpis/  heatmap/  charts/ Pure, unit-tested data shaping for each section
  shots/                   Lines shots up with the weekly schedule (taken / scheduled / missed)
  dates/  range/           Timezone-safe local dates and the range picker
db/schema.sql              The whole database schema
db/migrations/             Changes to apply to a database made before them
scripts/db-import.ts       Loads an export into an empty database
scripts/garmin/            Garmin Connect importer (Python)
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
