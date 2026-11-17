#!/usr/bin/env bash
# Applies db/migrations to production Neon: DATABASE_URL_UNPOOLED from .env.local, never the
# localhost DATABASE_URL that `npm run db:migrate` resolves to (.env.local defines DATABASE_URL
# twice and --env-file takes the last). Prints the host first and refuses a local database.
#
#   npm run db:migrate:prod
set -euo pipefail
cd "$(dirname "$0")/.."

url=$(grep -E '^[[:space:]]*DATABASE_URL_UNPOOLED[[:space:]]*=' .env.local | head -1 | sed -E 's/^[^=]*=[[:space:]]*//; s/^"//; s/"$//')
if [ -z "$url" ]; then
  echo "DATABASE_URL_UNPOOLED is not set in .env.local." >&2
  exit 1
fi
host=$(printf '%s' "$url" | sed -E 's#^[a-z]+://[^@]*@##; s#[:/?].*$##')
case "$host" in
  localhost | 127.0.0.1 | "")
    echo "DATABASE_URL_UNPOOLED points at '$host', not Neon; refusing." >&2
    exit 1
    ;;
esac
echo "migrating $host"
DATABASE_URL="$url" exec npx tsx scripts/db-migrate.ts
