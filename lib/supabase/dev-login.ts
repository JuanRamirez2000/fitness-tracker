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
