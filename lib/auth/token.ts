// Session tokens: `<payload>.<signature>`, where payload is base64url JSON {role, exp} and
// signature is its HMAC-SHA256 under SESSION_SECRET. Web Crypto only, and pure apart from the
// secret, which is passed in. The only role is "owner": viewing needs no session at all.

export const ROLES = ["owner"] as const;
export type Role = (typeof ROLES)[number];

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signToken(role: Role, secret: string, nowMs = Date.now()): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ role, exp: nowMs + SESSION_MAX_AGE_S * 1000 })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The token's role, or null if it is malformed, tampered with or expired. */
export async function verifyToken(token: string | undefined, secret: string, nowMs = Date.now()): Promise<Role | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const { role, exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (typeof exp !== "number" || exp < nowMs) return null;
    return ROLES.includes(role) ? role : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison, so a password check can't leak through its timing how
 * many leading characters matched: HMAC `a`, then have verify() recompute it over `b` and
 * compare the two digests in constant time. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const key = await hmacKey("compare");
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(a));
  return crypto.subtle.verify("HMAC", key, digest, encoder.encode(b));
}
