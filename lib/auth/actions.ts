"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/supabase/session";

export interface SignInState {
  error: string | null;
  /** Echoed back because React resets the form after an action, which would wipe the email. */
  email: string;
}

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const submitted = formData.get("email");
  const email = typeof submitted === "string" ? submitted : "";

  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // One message for wrong email and wrong password, so the form never confirms an account.
    return {
      error:
        error.code === "invalid_credentials"
          ? "Email or password is incorrect."
          : "Could not sign in. Try again.",
      email,
    };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
