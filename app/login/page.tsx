import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Unlock editing" };

/** Viewing is public; this page only unlocks adding, editing and deleting for 30 days. */
export default async function LoginPage() {
  if ((await getRole()) === "owner") redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-[380px] rounded-[14px] border border-border-strong bg-card px-7 py-8 shadow-[0_22px_50px_rgba(0,0,0,0.55)]">
        <h1 className="mb-1.5 font-serif text-[21px]">Unlock editing</h1>
        <p className="mb-6 text-[12.5px] text-muted-2">Anyone can view the dashboard. The owner password lets this browser make changes.</p>
        <LoginForm />
        <Link href="/" className="mt-4 block text-center text-[12px] text-muted-2 hover:text-ink">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
