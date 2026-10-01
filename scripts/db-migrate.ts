/**
 * Applies every db/migrations/*.sql file, in name order, to DATABASE_URL. Each migration is
 * written to be safe to re-run, so this needs no bookkeeping table: run it after pulling a
 * change that adds one.
 *
 *   npm run db:migrate                                   # .env.local's DATABASE_URL
 *   DATABASE_URL='<neon unpooled url>' npx tsx scripts/db-migrate.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    for (const file of readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
      await sql.begin((tx) => tx.unsafe(readFileSync(join("db/migrations", file), "utf8")));
      console.log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
