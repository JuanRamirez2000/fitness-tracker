import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next 16 renamed the `middleware` file convention to `proxy`; behavior is unchanged.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
