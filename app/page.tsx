import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getViewer } from "@/lib/auth/viewer";
import { LOGIN_PATH } from "@/lib/supabase/session";

export default async function DashboardPage() {
  const viewer = await getViewer();
  // proxy.ts already routes signed-out visitors to /login; this narrows the type.
  if (!viewer) redirect(LOGIN_PATH);

  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="flex-1" />
    </>
  );
}
