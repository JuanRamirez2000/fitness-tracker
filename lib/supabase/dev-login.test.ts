import { afterEach, describe, expect, it, vi } from "vitest";
import { devLoginCredentials, isLoginSkipped } from "./dev-login";

afterEach(() => vi.unstubAllEnvs());

function env(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

const CREDENTIALS = { DEV_LOGIN_EMAIL: "dev@example.com", DEV_LOGIN_PASSWORD: "hunter2" };

describe("isLoginSkipped", () => {
  it("is off unless DEV_SKIP_LOGIN is exactly 'true'", () => {
    env({ NODE_ENV: "development" });
    expect(isLoginSkipped()).toBe(false);
    env({ DEV_SKIP_LOGIN: "1" });
    expect(isLoginSkipped()).toBe(false);
    env({ DEV_SKIP_LOGIN: "true" });
    expect(isLoginSkipped()).toBe(true);
  });

  it("can never be turned on in a production build, whatever the flag says", () => {
    env({ NODE_ENV: "production", DEV_SKIP_LOGIN: "true" });
    expect(isLoginSkipped()).toBe(false);
  });
});

describe("devLoginCredentials", () => {
  it("returns the account only when the skip is on and both values are set", () => {
    env({ NODE_ENV: "development", DEV_SKIP_LOGIN: "true", ...CREDENTIALS });
    expect(devLoginCredentials()).toEqual({ email: "dev@example.com", password: "hunter2" });
  });

  it("returns null when either credential is missing", () => {
    env({ NODE_ENV: "development", DEV_SKIP_LOGIN: "true", DEV_LOGIN_EMAIL: "dev@example.com" });
    expect(devLoginCredentials()).toBeNull();
  });

  it("returns null without the flag, even with credentials present", () => {
    env({ NODE_ENV: "development", ...CREDENTIALS });
    expect(devLoginCredentials()).toBeNull();
  });

  it("never signs in automatically in production", () => {
    env({ NODE_ENV: "production", DEV_SKIP_LOGIN: "true", ...CREDENTIALS });
    expect(devLoginCredentials()).toBeNull();
  });
});
