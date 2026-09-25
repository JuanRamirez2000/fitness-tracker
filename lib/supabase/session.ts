import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";
import { devLoginCredentials, isAuthDisabled, isLoginSkipped } from "./dev-login";
import { createServiceRoleClient } from "./service-role";

export const LOGIN_PATH = "/login";

const CACHE_HEADERS = ["cache-control", "expires", "pragma"];

/**
 * Refreshes the Supabase session cookies and applies the app's one routing rule: every path
 * except /login needs a signed-in user. This only routes; RLS is the real authorization.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, key } = supabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // These keep a CDN from caching a response that carries a session token.
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // getUser() re-validates the token with Supabase Auth; getSession() would trust the cookie.
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const user = sessionUser ?? (await devSignIn(supabase)) ?? (await autoSignInOwner(supabase));
  const onLogin = request.nextUrl.pathname === LOGIN_PATH;

  if (!user && !onLogin && !isLoginSkipped() && !isAuthDisabled())
    return redirect(request, LOGIN_PATH, response);
  if (user && onLogin) return redirect(request, "/", response);
  return response;
}

/** Temporary dev shortcut (see dev-login.ts): sign in as the configured account, if any. */
async function devSignIn(supabase: SupabaseClient): Promise<User | null> {
  const credentials = devLoginCredentials();
  if (!credentials) return null;
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    console.warn(`DEV_SKIP_LOGIN: could not sign in as ${credentials.email}: ${error.message}`);
    return null;
  }
  return data.user;
}

/**
 * DISABLE_AUTH's real mechanism (see dev-login.ts's isAuthDisabled doc comment). The user
 * asked for the deployed app to work with no sign-in at all, reads AND writes, and explicitly
 * said they don't need the data private — but "no password touched by me" still stands, so
 * this doesn't store or type a password anywhere. Instead it mints a genuine Supabase Auth
 * session for the owner account server-side, via the admin API: generate a magic-link token
 * for the owner's own email, then immediately verify it — the same mechanism a real
 * magic-link sign-in uses, just without emailing it anywhere. The service-role key that makes
 * this possible never leaves the server (createServiceRoleClient is server-only); only the
 * resulting session cookies — identical in shape to a normal sign-in's — reach the browser.
 * Because this produces a REAL session, every existing feature (client-side reads and writes
 * alike) works completely unmodified; no per-component bypass code needed anywhere else.
 * Runs once per browser: after this, sessionUser above is truthy on every later request from
 * the same browser and this is skipped entirely.
 */
async function autoSignInOwner(supabase: SupabaseClient): Promise<User | null> {
  if (!isAuthDisabled()) return null;
  try {
    const admin = createServiceRoleClient();
    const { data: owner } = await admin.from("profiles").select("id").eq("role", "owner").single();
    if (!owner) return null;

    const { data: ownerUser } = await admin.auth.admin.getUserById(owner.id);
    const email = ownerUser.user?.email;
    if (!email) return null;

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkError || !link.properties?.hashed_token) return null;

    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
    if (verifyError) return null;
    return verified.user;
  } catch {
    return null;
  }
}

/** A redirect must carry the refreshed auth cookies, or the browser keeps the stale ones. */
function redirect(request: NextRequest, pathname: string, from: NextResponse): NextResponse {
  const to = NextResponse.redirect(new URL(pathname, request.url));
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  CACHE_HEADERS.forEach((name) => {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  });
  return to;
}
