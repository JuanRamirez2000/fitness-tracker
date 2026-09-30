import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, verifyToken, type Role } from "./token";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 random characters. See .env.example.");
  }
  return secret;
}

/** "owner" when this browser has unlocked editing, otherwise null. Memoized per request. */
export const getRole = cache(async (): Promise<Role | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifyToken(token, sessionSecret());
});

/** For server actions that change data: only the owner may write. The page hides the edit
 * controls from everyone else, but a server action is its own public endpoint, so it checks
 * here rather than trusting the page it was rendered on. */
export async function requireOwner(): Promise<void> {
  if ((await getRole()) !== "owner") throw new Error("Only the owner can change data.");
}
