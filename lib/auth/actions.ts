"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionSecret } from "./session";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, safeEqual, signToken } from "./token";

export interface SignInState {
  error: string | null;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password === "") return { error: "Enter the password." };

  const owner = process.env.OWNER_PASSWORD;
  if (!owner) throw new Error("OWNER_PASSWORD is not set. See .env.example.");
  if (!(await safeEqual(password, owner))) return { error: "That password is incorrect." };

  (await cookies()).set(SESSION_COOKIE, await signToken("owner", sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  redirect("/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
