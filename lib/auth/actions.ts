"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionSecret } from "./session";
import { LOGIN_PATH, SESSION_COOKIE, SESSION_MAX_AGE_S, safeEqual, signToken, type Role } from "./token";

export interface SignInState {
  error: string | null;
}

/** Which role a password unlocks: OWNER_PASSWORD edits, VIEWER_PASSWORD (optional) only reads. */
async function roleFor(password: string): Promise<Role | null> {
  const owner = process.env.OWNER_PASSWORD;
  const viewer = process.env.VIEWER_PASSWORD;
  if (!owner) throw new Error("OWNER_PASSWORD is not set. See .env.example.");
  // Check both every time, so the response time doesn't reveal which one matched.
  const [isOwner, isViewer] = await Promise.all([
    safeEqual(password, owner),
    viewer ? safeEqual(password, viewer) : Promise.resolve(false),
  ]);
  return isOwner ? "owner" : isViewer ? "viewer" : null;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password === "") return { error: "Enter the password." };

  const role = await roleFor(password);
  if (!role) return { error: "That password is incorrect." };

  (await cookies()).set(SESSION_COOKIE, await signToken(role, sessionSecret()), {
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
  redirect(LOGIN_PATH);
}
