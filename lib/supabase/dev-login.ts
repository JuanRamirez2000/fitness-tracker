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
 * asked to be able to use the deployed app without signing in (2026-09-23), read AND write,
 * and said they don't need the data private — while keeping the login screen and RLS-based
 * access control intact and unremoved for whenever they want it back. While the first version
 * of this only bypassed reads (via a service-role client in place of a real session), the
 * user then explicitly asked for writes to work too — Log today, the entries table, layout
 * editing — none of which have a service-role equivalent since they run through the browser's
 * own Supabase client. So DISABLE_AUTH now means something more real: with it on,
 * lib/supabase/session.ts's autoSignInOwner() mints an actual Supabase Auth session for the
 * owner, server-side, via the admin API — no password touched anywhere in that path (it
 * generates and immediately verifies a magic-link token instead of ever handling one). From
 * then on the browser has a completely normal session, so every feature — server-rendered
 * reads and client-side writes alike — works exactly as it does for a real signed-in user,
 * with no bypass code needed anywhere else in the app.
 *
 * This is a real, deliberate widening of this app's access control, not a cosmetic toggle:
 * with it on, the deployed URL shows real data AND accepts real edits from anyone who has the
 * link, no sign-in of any kind. Turn it back off by removing DISABLE_AUTH from Vercel's
 * project env vars (Production) and redeploying — no code change either way.
 */
export function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === "true";
}
