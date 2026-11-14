/**
 * The workout builder from the command line, for the /workout skill (.claude/skills/workout/)
 * and by hand. Same builder and planner as the Training tab's "Plan a workout" (lib/workouts/).
 *
 *   npm run workout -- week [--json]                       # the next 7 days, phase, suggestions
 *   npm run workout -- preview --sport run --date 2026-11-16 --effort 2 --minutes 30 [--kind easy] [--json]
 *   npm run workout -- plan    --sport run --date 2026-11-16 --effort 2 --minutes 30 [--kind easy] [--send]
 *   npm run workout -- send    --id <uuid>                 # send a saved draft (or retry a failed one)
 *   npm run workout -- remove  --id <uuid>                 # take it off the plan and the Garmin calendar
 *   npm run workout -- settings [--swim-stage 1] [--ftp 150 | --ftp auto]
 *
 * Unlike the other npm scripts, this one talks to PRODUCTION by default (the first non-localhost
 * DATABASE_URL in .env.local, or an exported DATABASE_URL): the point is the website and the
 * watch. --local uses the localhost database instead. `--send` and `send` run
 * scripts/garmin/push_workout.py right here (the Garmin login in ~/.garminconnect, shared with
 * GitHub Actions through garmin_token_cache), so the workout reaches Garmin in seconds.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const ROOT = join(import.meta.dirname, "..");

function databaseUrl(local: boolean): string {
  const lines = existsSync(join(ROOT, ".env.local")) ? readFileSync(join(ROOT, ".env.local"), "utf8").split("\n") : [];
  const urls = lines
    .map((l) => l.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/)?.[1]?.replace(/^["']|["']$/g, ""))
    .filter((u): u is string => Boolean(u));
  const isLocal = (u: string) => ["localhost", "127.0.0.1"].includes(new URL(u).hostname);
  if (local) {
    const url = urls.find(isLocal);
    if (!url) throw new Error("No localhost DATABASE_URL in .env.local.");
    return url;
  }
  const exported = process.env.DATABASE_URL;
  if (exported && !isLocal(exported)) return exported;
  const url = urls.find((u) => !isLocal(u));
  if (!url) throw new Error("No production DATABASE_URL (exported or in .env.local). Use --local for the localhost one.");
  return url;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    sport: { type: "string" },
    date: { type: "string" },
    kind: { type: "string", default: "auto" },
    effort: { type: "string", default: "2" },
    minutes: { type: "string" },
    id: { type: "string" },
    send: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    local: { type: "boolean", default: false },
    "swim-stage": { type: "string" },
    ftp: { type: "string" },
  },
});

const command = positionals[0] ?? "week";
const url = databaseUrl(values.local);
process.env.DATABASE_URL = url;

async function main() {
  // Imported after DATABASE_URL is set: lib/db.ts reads it on first use.
  const { db } = await import("../lib/db");
  const { profileSchema } = await import("../lib/data/profiles");
  const { todayIn } = await import("../lib/dates/timezone");
  const { buildContext, buildWorkout, resolveKind, zonesFor } = await import("../lib/workouts/build");
  const { SPORTS } = await import("../lib/sport");
  const { workoutLines, fmtDuration } = await import("../lib/workouts/describe");
  const { warningsFor } = await import("../lib/workouts/plan");
  const { loadPlanner, saveWorkout, workoutRequestSchema } = await import("../lib/workouts/service");
  const { SWIM_STAGES, workoutSettingsPatchSchema } = await import("../lib/workouts/settings");
  const store = await import("../lib/workouts/store");

  const log = values.json ? () => {} : (s = "") => console.log(s);
  log(`Database: ${new URL(url).hostname}`);

  try {
    const [row] = await db()`
      select id, display_name, timezone, program_start_date, goal_weight_lb, goal_pace_lb_per_week, start_weight_lb,
             shot_weekday, hr_zone_bounds, hr_zone_bounds_cycling, workout_settings
      from profiles order by created_at limit 1`;
    if (!row) throw new Error("No profile row in this database.");
    const profile = profileSchema.parse(row);
    const today = todayIn(profile.timezone);
    const planner = await loadPlanner(profile, today);

    const requestFromArgs = () => {
      const sport = values.sport as "run" | "ride" | "swim";
      const effort = Number(values.effort) as 1 | 2 | 3 | 4 | 5;
      // Without --minutes, the template's own default length.
      const fallback = SPORTS.includes(sport) ? resolveKind(sport, values.kind ?? "auto", effort, buildContext(planner)).minutes[2] : 30;
      return workoutRequestSchema.parse({
        sport,
        date: values.date ?? today,
        kind: values.kind,
        effort,
        minutes: Number(values.minutes ?? fallback),
      });
    };

    const describeWorkout = (request: ReturnType<typeof requestFromArgs>) => {
      const workout = buildWorkout({ ...request, effort: request.effort as 1 | 2 | 3 | 4 | 5 }, buildContext(planner));
      const lines = workoutLines(workout.blocks, { ftpW: planner.ftp.watts, hrZones: zonesFor(planner, request.sport), pool: planner.settings.pool });
      const warnings = warningsFor({ ...request, minutes: Math.round(workout.seconds / 60) }, planner.plan);
      return { workout, lines, warnings };
    };

    if (command === "week") {
      const out = {
        today,
        phase: planner.plan.phase,
        coached_sports: planner.plan.coached,
        planned_hours_next_7_days: Math.round(planner.plan.weekMinutes / 6) / 10,
        weekly_hour_limit: planner.settings.weekly_hours_max,
        ftp: planner.ftp,
        swim_stage: SWIM_STAGES[planner.settings.swim_stage].label,
        pool: planner.settings.pool,
        swim_days: planner.settings.swim_days,
        recent_minutes_per_week: planner.plan.recentWeeklyMinutes,
        typical_session_minutes: planner.plan.typicalRecent,
        days: planner.plan.days.map((d) => ({
          date: d.date,
          coach: d.restDay ? "rest day" : d.coach.map((c) => `${c.name}${c.key_workout ? " (key)" : ""} ${Math.round((c.duration_s ?? 0) / 60)} min`),
          own: planner.planned
            .filter((w) => w.source === "self" && w.local_date === d.date)
            .map((w) => ({ id: w.workout_uuid, name: w.name, status: w.push_status })),
        })),
        suggestions: planner.plan.suggestions,
      };
      if (values.json) console.log(JSON.stringify(out, null, 2));
      else {
        log(`${out.phase.label}${out.phase.race ? ` · ${out.phase.weeksToRace} weeks to ${out.phase.race.name}` : ""}`);
        log(`Coached by Garmin: ${out.coached_sports.join(", ") || "nothing"} · ${out.planned_hours_next_7_days} h planned of ${out.weekly_hour_limit} h`);
        for (const d of out.days) {
          log(`${d.date}  ${Array.isArray(d.coach) ? d.coach.join("; ") || "-" : d.coach}${d.own.map((o) => `  + ${o.name} [${o.status}] ${o.id}`).join("")}`);
        }
        log("\nSuggested:");
        for (const s of out.suggestions) log(`  ${s.date} ${s.sport} ${s.kind} effort ${s.effort} ${s.minutes} min: ${s.why}`);
      }
    } else if (command === "preview" || command === "plan") {
      const request = requestFromArgs();
      const { workout, lines, warnings } = describeWorkout(request);
      if (command === "preview") {
        if (values.json) console.log(JSON.stringify({ request, name: workout.name, why: workout.why, minutes: Math.round(workout.seconds / 60), steps: lines, warnings }, null, 2));
        else {
          log(`${workout.name} · ≈ ${fmtDuration(Math.round(workout.seconds / 60) * 60)} · ${request.date}`);
          log(workout.why);
          for (const l of lines) log(`  ${l}`);
          for (const w of warnings) log(`  ! ${w}`);
        }
        return;
      }
      if (request.date < today) throw new Error("Pick today or a later day.");
      const { uuid } = await saveWorkout(profile.id, planner, { ...request, effort: request.effort as 1 | 2 | 3 | 4 | 5 }, values.send);
      log(`Saved ${workout.name} on ${request.date} (${uuid})${values.send ? ", sending to Garmin…" : " as a draft."}`);
      if (values.send) runPush(uuid);
      if (values.json) console.log(JSON.stringify({ id: uuid, name: workout.name, date: request.date, warnings }, null, 2));
    } else if (command === "send") {
      const id = values.id ?? "";
      if (!(await store.fetchSelfWorkout(profile.id, id))) throw new Error(`No workout ${id}.`);
      await store.setPushStatus(profile.id, id, "queued");
      runPush(id);
    } else if (command === "remove") {
      const id = values.id ?? "";
      const w = await store.fetchSelfWorkout(profile.id, id);
      if (!w) throw new Error(`No workout ${id}.`);
      if (!w.garmin_workout_id) {
        await store.deleteSelfWorkout(profile.id, id);
        log("Removed (it was never on Garmin).");
      } else {
        await store.setPushStatus(profile.id, id, "removing");
        runPush(id);
      }
    } else if (command === "settings") {
      const patch = workoutSettingsPatchSchema.parse({
        ...(values["swim-stage"] !== undefined ? { swim_stage: Number(values["swim-stage"]) } : {}),
        ...(values.ftp !== undefined ? { ftp_w: values.ftp === "auto" ? null : Number(values.ftp) } : {}),
      });
      if (Object.keys(patch).length) await store.updateWorkoutSettings(profile.id, patch);
      log(`Settings: ${JSON.stringify({ ...planner.settings, ...patch })}`);
    } else {
      throw new Error(`Unknown command "${command}". Use week, preview, plan, send, remove or settings.`);
    }
  } finally {
    await db().end();
  }
}

/** Sends (or removes) one workout through the Python Garmin login, here and now. */
function runPush(id: string) {
  const python = join(ROOT, "scripts/garmin/.venv/bin/python");
  if (!existsSync(python)) {
    console.log("No Garmin venv (scripts/garmin/.venv); it stays queued for GitHub Actions.");
    return;
  }
  execFileSync(python, [join(ROOT, "scripts/garmin/push_workout.py"), "--id", id], {
    stdio: values.json ? ["ignore", "ignore", "inherit"] : "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
