import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getViewer } from "@/lib/auth/viewer";
import { isLoginSkipped } from "@/lib/supabase/dev-login";
import { LOGIN_PATH } from "@/lib/supabase/session";

export default async function DashboardPage() {
  const viewer = await getViewer();
  // proxy.ts already routes signed-out visitors to /login; this narrows the type and only
  // lets a missing viewer through while the temporary dev login skip is on.
  if (!viewer && !isLoginSkipped()) redirect(LOGIN_PATH);

  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="flex-1" />
    </>
  );
}
