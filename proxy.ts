import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE, verifyToken } from "@/lib/auth/token";

// Next 16 renamed the `middleware` file convention to `proxy`; behavior is unchanged.
// The app's one routing rule: signed out → /login, signed in → never /login.
export async function proxy(request: NextRequest) {
  const secret = process.env.SESSION_SECRET ?? "";
  const role = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  const onLogin = request.nextUrl.pathname === LOGIN_PATH;

  if (!role && !onLogin) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  if (role && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
