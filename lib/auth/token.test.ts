import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_S, safeEqual, signToken, verifyToken } from "./token";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const NOW = Date.UTC(2026, 8, 29);

describe("signToken / verifyToken", () => {
  it("round-trips the owner role", async () => {
    expect(await verifyToken(await signToken("owner", SECRET, NOW), SECRET, NOW)).toBe("owner");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signToken("owner", SECRET, NOW);
    expect(await verifyToken(token, `${SECRET}-rotated`, NOW)).toBeNull();
  });

  it("rejects a token whose payload was edited to extend its expiry", async () => {
    const [, signature] = (await signToken("owner", SECRET, NOW)).split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ role: "owner", exp: NOW + 1e12 })).toString("base64url");
    expect(await verifyToken(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("expires after SESSION_MAX_AGE_S", async () => {
    const token = await signToken("owner", SECRET, NOW);
    expect(await verifyToken(token, SECRET, NOW + SESSION_MAX_AGE_S * 1000 - 1)).toBe("owner");
    expect(await verifyToken(token, SECRET, NOW + SESSION_MAX_AGE_S * 1000 + 1)).toBeNull();
  });

  it("rejects missing and malformed tokens without throwing", async () => {
    for (const bad of [undefined, "", "abc", "abc.def", "a.b.c", "!!!.???"]) {
      expect(await verifyToken(bad, SECRET, NOW)).toBeNull();
    }
  });
});

describe("safeEqual", () => {
  it("matches only identical strings", async () => {
    expect(await safeEqual("hunter2", "hunter2")).toBe(true);
    expect(await safeEqual("hunter2", "hunter3")).toBe(false);
    expect(await safeEqual("hunter2", "hunter22")).toBe(false);
    expect(await safeEqual("", "x")).toBe(false);
  });
});
