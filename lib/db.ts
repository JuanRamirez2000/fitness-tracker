import postgres from "postgres";

// Postgres type OIDs whose default postgres.js parsing doesn't match what lib/data's zod
// schemas expect: dates and timestamps stay the plain strings Postgres sends (the rest of
// the app works in LocalDate strings, never Date objects), and numeric/bigint become numbers
// (weights are numeric(6,2), weight_trend.n7 is a count(*) bigint — small enough either way).
const asText = (oid: number) => ({ to: oid, from: [oid], serialize: String, parse: (v: string) => v });
const asNumber = (oid: number) => ({ to: oid, from: [oid], serialize: String, parse: Number });

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return postgres(url, {
    // Neon's pooled connection string runs PgBouncer in transaction mode, which can't
    // hold named prepared statements across transactions.
    prepare: false,
    max: 5,
    types: {
      date: asText(1082),
      timestamp: asText(1114),
      timestamptz: asText(1184),
      numeric: asNumber(1700),
      bigint: asNumber(20),
    },
  });
}

// One pool per server process. Kept on globalThis so `next dev`'s hot reload doesn't open
// a new pool on every edit.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof connect> };

export function db() {
  globalForDb.sql ??= connect();
  return globalForDb.sql;
}
