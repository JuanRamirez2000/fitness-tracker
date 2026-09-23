/**
 * TEMPORARY, development only. With DEV_SKIP_LOGIN=true, `next dev` never sends anyone to the
 * login screen and, when DEV_LOGIN_EMAIL and DEV_LOGIN_PASSWORD are also set, signs in as that
 * account by itself, so every query still runs under RLS as a real user.
 *
 * Production builds ignore all of it: NODE_ENV is "production" on Vercel, previews included.
 */
export function isLoginSkipped(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_SKIP_LOGIN === "true";
}

export function devLoginCredentials(): { email: string; password: string } | null {
  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;
  return isLoginSkipped() && email && password ? { email, password } : null;
}

/**
 * A SEPARATE switch from the one above, deliberately allowed in production too — the user
 * asked to be able to review the deployed app without signing in (2026-09-23), while keeping
 * the login screen and RLS-based access control intact and unremoved for whenever they want
 * it back. With DISABLE_AUTH=true: no redirect to /login (see lib/supabase/session.ts), and
 * getViewer() (lib/auth/viewer.ts) reads the owner's profile through the service-role key
 * instead of a real Supabase Auth session — no password involved anywhere in this path.
 *
 * This is a real, temporary widening of this app's access control, not a cosmetic toggle:
 * with it on, the deployed URL shows real data to anyone who has the link, no sign-in of any
 * kind. Turn it back off by removing DISABLE_AUTH from Vercel's project env vars (Production)
 * and redeploying — no code change either way.
 */
export function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === "true";
}
