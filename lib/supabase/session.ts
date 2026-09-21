import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

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
    data: { user },
  } = await supabase.auth.getUser();
  const onLogin = request.nextUrl.pathname === LOGIN_PATH;

  if (!user && !onLogin) return redirect(request, LOGIN_PATH, response);
  if (user && onLogin) return redirect(request, "/", response);
  return response;
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
