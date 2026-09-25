import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * A service-role client, bypassing RLS entirely — used by exactly one caller,
 * lib/supabase/session.ts's autoSignInOwner(), which under DISABLE_AUTH uses this admin-level
 * access to mint a real Supabase Auth session for the owner (never a password: generates and
 * immediately verifies a magic-link token server-side). Every other query in this app goes
 * through lib/supabase/server.ts's cookie-bound client instead, which runs under RLS as
 * whichever real user is signed in; the original rule (schema.sql's own comments, scripts/*'s
 * own docstrings) was "service-role key only in scripts/, never app code" — this is a
 * deliberate, explicit exception to that rule, not an oversight, made at the user's own
 * request (2026-09-23) so the deployed app works without signing in. `import "server-only"`
 * makes any accidental client-side import of this file a build error, not just a convention.
 */
export function createServiceRoleClient() {
  const { url } = supabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("DISABLE_AUTH is on but SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
