# Tracker

A private weight and logging-consistency tracker for two people: an owner
and a coach with full read/write parity. Not a calorie counter, not a
medical app — it tracks weight trend, a weekly shot day, steps, activity
and logging consistency itself, on the theory that showing up regularly
matters as much as any single number.

## Stack

- **Next.js 16** (App Router) + **TypeScript** (strict) + **Tailwind CSS 4**
- **Supabase** (Postgres + Auth via `@supabase/ssr`) — RLS enforces every
  access rule; the app never re-checks permissions client-side
- **visx** (`@visx/scale` + `@visx/shape` + `@visx/group`) for the charts
- **TanStack Table**, **react-hook-form** + **zod**, **react-day-picker**
- **Vitest** for unit tests

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + publishable key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the
login screen unless `DEV_SKIP_LOGIN=true` is set in `.env.local` (dev only
— see the comments in `.env.example` and `lib/supabase/dev-login.ts`;
production builds ignore it regardless).

### Database

`supabase/schema.sql` is the single source of truth for the schema — run
it once, in full, against a fresh Supabase project's SQL editor. It creates
every table, RLS policy, view and trigger this app uses, including the
`private.can_read()` helper and the `garmin_token_cache` table the Garmin
import scripts share a login session through (see below). Two accounts
only: an `owner` role and a `coach` role, linked via `coach_access` — both
are set up by hand in the Supabase dashboard, not through any sign-up flow
(new sign-ups are intentionally never allowed).

## Scripts

```bash
npm run dev         # local dev server
npm run build        # production build
npm run start         # run a production build locally
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run test           # vitest
npm run seed:demo -- --i-am-on-dev   # generates ~6 months of fake data for UI work — DEV projects only
```

## Real data from Garmin Connect

`scripts/garmin/` is a separate Python project (its own venv) that imports
real steps, weight and activity history from Garmin Connect via the
unofficial [`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
library — there is no official personal-use Garmin API. See
`scripts/garmin/README.md` for the full setup, and
`.github/workflows/garmin-nightly.yml` for the nightly cloud job (GitHub
Actions, not this app, and not any one person's machine — Supabase Edge
Functions can't run this, since they're Deno-only and this needs Python).
In short:

- **Nightly**, automatically, in the cloud: yesterday's data.
- **On demand**: the dashboard's "Refresh" button pulls today only.
- Both write `source = 'garmin'` rows, idempotent by Garmin's own
  per-record ID — safe to re-run any window at any time.

## Project structure

```
app/                    Routes (App Router) — page.tsx is the dashboard
components/
  dashboard/             Data table, quick-log/day-editor sheet, KPI grid, range control
  heatmap/                The GitHub-style activity heatmap and its per-mode tooltips
  charts/                 The visx-based charts section
  feature-requests/        The "Ideas queue" panel
  ui/                      Small shared primitives (Dialog, Button, ChipRow, Segmented)
lib/
  dashboard/               DashboardData loading, the HeatmapMode/KpiDefinition/TableTab registries
  data/                     One file per table: zod schemas + typed fetch/insert/update functions
  dates/                    Timezone-safe local-date math (never derive a date from UTC — see lib/dates/timezone.ts)
  heatmap/, kpis/, charts/   Pure, unit-tested functions that turn DashboardData into what each UI piece renders
  shots/                    Matches injection rows to the weekly shot schedule
  theme/                    Design tokens and the color-blind palette
scripts/
  garmin/                   The Python import tooling (see above)
  seed-demo.ts               Generates demo data for local UI work
supabase/schema.sql          The whole database schema, source of truth
```

## Design principles this codebase follows

- **Registries over conditionals.** Adding a new heatmap mode, KPI card,
  data table tab, or chart is "one new file + one line in
  `dashboard.config.ts`" — never a change to the component that renders
  them.
- **`local_date` is never derived from a UTC timestamp.** Every
  timezone-sensitive calculation goes through `lib/dates/timezone.ts`,
  which converts through `Intl.DateTimeFormat` so DST is always correct.
- **Coach and owner have equal access.** RLS grants the coach the same
  read/write permissions as the owner on the linked athlete's data — there
  is no read-only mode in this app.
- **Pure logic, dumb components.** Anything that shapes data for the UI
  (a KPI's `compute()`, a heatmap mode's `toCells()`, a chart's
  `build*()`) is a plain, unit-tested function; components only turn that
  output into pixels.
