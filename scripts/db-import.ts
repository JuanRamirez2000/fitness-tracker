/**
 * Loads a Supabase export (backups/<date>/*.json) into an EMPTY Postgres database:
 * applies db/schema.sql, then copies the profile, every weigh-in and the Garmin session.
 *
 *   npm run db:import -- backups/2026-09-30
 *
 * Reads DATABASE_URL from .env.local. Refuses to run if the tables already exist, so it can
 * never double-import or overwrite live data.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

function load<T>(dir: string, table: string): T[] {
  return JSON.parse(readFileSync(join(dir, `${table}.json`), "utf8")) as T[];
}

async function main() {
  const dir = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!dir) throw new Error("Usage: npm run db:import -- backups/<date>");
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    const [{ exists }] = await sql`select to_regclass('public.weigh_ins') is not null as exists`;
    if (exists) throw new Error("weigh_ins already exists here. db:import only runs against an empty database.");

    const profiles = load<Record<string, unknown>>(dir, "profiles");
    const owner = profiles.find((p) => p.role !== "coach") ?? profiles[0];
    if (!owner) throw new Error(`No profile in ${dir}/profiles.json.`);
    const weighIns = load<Record<string, unknown>>(dir, "weigh_ins").filter((w) => w.user_id === owner.id);
    const tokens = load<{ tokens: unknown }>(dir, "garmin_token_cache");

    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync("db/schema.sql", "utf8"));
      await tx`insert into profiles ${tx(owner, "id", "display_name", "timezone", "program_start_date", "goal_weight_lb", "goal_pace_lb_per_week", "start_weight_lb", "created_at")}`;
      const cols = ["id", "user_id", "measured_at", "local_date", "weight_lb", "source", "external_id", "created_at"] as const;
      for (let i = 0; i < weighIns.length; i += 500) {
        await tx`insert into weigh_ins ${tx(weighIns.slice(i, i + 500), ...cols)}`;
      }
      if (tokens[0]) await tx`insert into garmin_token_cache (id, tokens) values (1, ${tx.json(tokens[0].tokens as never)})`;
    });

    const [{ count }] = await sql`select count(*)::int as count from weigh_ins`;
    console.log(`Imported profile "${owner.display_name}", ${count} weigh-ins${tokens[0] ? ", and the Garmin session" : ""}.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
