import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-[380px] rounded-[14px] border border-border-strong bg-card px-7 py-8 shadow-[0_22px_50px_rgba(0,0,0,0.55)]">
        <h1 className="mb-6 font-serif text-[21px]">{APP_NAME}</h1>
        <LoginForm />
      </div>
    </main>
  );
}
