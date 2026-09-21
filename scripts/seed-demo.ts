/**
 * DEV ONLY. Replaces one account's tracking data with about six months of generated demo
 * data so the UI can be built and screenshot-compared.
 *
 *   npm run seed:demo -- --i-am-on-dev
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_ID from
 * .env.seed.local (uncommitted). The service-role key bypasses RLS, so it lives only in
 * this script and is never read by app code. Point it at a DEV project, never production.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates/calendar";
import { todayIn } from "@/lib/dates/timezone";
import { fetchProfile } from "@/lib/data/profiles";
import { generateDemoData } from "./demo-data";

const DEV_FLAG = "--i-am-on-dev";
const DEMO_DAYS = 182;
const SEED = 20260917;
const START_WEIGHT_LB = 232.4;
const INSERT_BATCH = 500;

const TRACKING_TABLES = [
  "weigh_ins",
  "nutrition_days",
  "activities",
  "injections",
  "daily_metrics",
] as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function requiredEnv(name: string): string {
  return process.env[name] || fail(`Missing ${name}. Set it in .env.seed.local.`);
}

async function insertAll(supabase: SupabaseClient, table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + INSERT_BATCH));
    if (error) fail(`Insert into ${table} failed: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
  if (!process.argv.includes(DEV_FLAG)) {
    fail(
      `Refusing to run without ${DEV_FLAG}. This deletes and replaces the account's tracking ` +
        "data using the service-role key; only run it against a DEV Supabase project.",
    );
  }

  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const userId = requiredEnv("SEED_USER_ID");
  const supabase = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const profile = await fetchProfile(supabase, userId);
  if (profile.role !== "owner") fail(`${userId} is a ${profile.role}; seed an owner account.`);
  console.log(`Target ${new URL(url).host}, account "${profile.display_name}" (${userId})`);

  const { data: types, error: typesError } = await supabase.from("activity_types").select("key");
  if (typesError) fail(`Could not read activity_types: ${typesError.message}`);

  const today = todayIn(profile.timezone);
  const programStart = addDays(today, -(DEMO_DAYS - 1));
  const demo = generateDemoData({
    userId,
    timeZone: profile.timezone,
    today,
    programStart,
    shotWeekday: profile.shot_weekday,
    startWeightLb: START_WEIGHT_LB,
    activityTypes: (types ?? []).map((t: { key: string }) => t.key),
    seed: SEED,
  });

  console.log(`Replacing tracking data for ${programStart} to ${today}:`);
  for (const table of TRACKING_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) fail(`Delete from ${table} failed: ${error.message}`);
  }
  await insertAll(supabase, "weigh_ins", demo.weighIns);
  await insertAll(supabase, "nutrition_days", demo.nutritionDays);
  await insertAll(supabase, "activities", demo.activities);
  await insertAll(supabase, "injections", demo.injections);
  await insertAll(supabase, "daily_metrics", demo.dailyMetrics);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      program_start_date: programStart,
      goal_weight_lb: 200,
      goal_pace_lb_per_week: 1.0,
      steps_goal: 10000,
    })
    .eq("id", userId);
  if (profileError) fail(`Profile update failed: ${profileError.message}`);
  console.log("Done. Profile set to the demo program window, goal 200 lb, pace 1.0 lb/week.");
}

main();
