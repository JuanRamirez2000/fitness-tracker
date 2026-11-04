/**
 * Garmin Connect Personal API client (https://developer.garmin.com/gc-developer-program/personal/).
 *
 * Auth is two steps: the long-lived Personal API key (GARMIN_PERSONAL_ACCESS_TOKEN, created
 * in Garmin Connect Web, expires after 30 days to 1 year) is exchanged for a 24-hour bearer
 * token. There are no refresh tokens; a new bearer token is simply minted from the key again.
 * The token is cached per process until shortly before it expires.
 *
 * No server-only guard: scripts/garmin-import.ts runs this from the command line too.
 */
import type { RawActivity, RawStepsDay, RawWeighIn } from "./map";

const BASE_URL = "https://personal.connectapi.garmin.com";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";
/** Mint a new token this long before the old one expires. */
const EXPIRY_MARGIN_MS = 10 * 60_000;
/** Used when the token's own expiry can't be read: Garmin documents 24 hours. */
const FALLBACK_LIFETIME_MS = 23 * 60 * 60_000;
const ACTIVITY_PAGE_SIZE = 100;

export class GarminError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GarminError";
  }
}

export function apiKeyFromEnv(): string {
  const key = process.env.GARMIN_PERSONAL_ACCESS_TOKEN?.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    throw new GarminError(
      "GARMIN_PERSONAL_ACCESS_TOKEN is not set. Create a key at Garmin Connect → Personal API Key (see .env.example).",
    );
  }
  return key;
}

interface CachedToken {
  key: string;
  token: string;
  expiresAt: number;
}

// Kept on globalThis so `next dev`'s hot reload doesn't mint a new token on every edit.
const globalForGarmin = globalThis as unknown as { garminToken?: CachedToken };

/** The `exp` claim of a JWT, in ms, or null when the token isn't a readable JWT. */
export function jwtExpiryMs(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** The token endpoint answers with the bare JWT as text; tolerate a JSON body too. */
export function parseTokenResponse(body: string): string {
  const text = body.trim();
  if (text.startsWith("{")) {
    const json = JSON.parse(text) as Record<string, unknown>;
    const token = json.access_token ?? json.accessToken ?? json.token;
    if (typeof token === "string" && token) return token;
    throw new GarminError("Garmin's token endpoint returned JSON without a token.");
  }
  return text.replace(/^"|"$/g, "");
}

async function mintToken(key: string): Promise<CachedToken> {
  const res = await fetch(`${BASE_URL}${TOKEN_PATH}`, {
    method: "POST",
    headers: { Authorization: `ApiKey ${key}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new GarminError(
      "Garmin rejected the Personal API key: it has expired or been deleted. Create a new one at " +
        "Garmin Connect → Personal API Key and update GARMIN_PERSONAL_ACCESS_TOKEN.",
      res.status,
    );
  }
  if (!res.ok) throw new GarminError(`Garmin's token endpoint failed (${res.status}).`, res.status);
  const token = parseTokenResponse(await res.text());
  if (!token) throw new GarminError("Garmin's token endpoint returned an empty token.");
  const expiresAt = (jwtExpiryMs(token) ?? Date.now() + FALLBACK_LIFETIME_MS) - EXPIRY_MARGIN_MS;
  return { key, token, expiresAt };
}

export class GarminClient {
  constructor(private readonly key: string = apiKeyFromEnv()) {}

  private async token(forceNew = false): Promise<string> {
    const cached = globalForGarmin.garminToken;
    if (!forceNew && cached && cached.key === this.key && cached.expiresAt > Date.now()) return cached.token;
    globalForGarmin.garminToken = await mintToken(this.key);
    return globalForGarmin.garminToken.token;
  }

  async get<T>(path: string, query: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = new URL(path, BASE_URL);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));

    const send = async (token: string) =>
      fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });

    let res = await send(await this.token());
    // A cached token can be revoked early (the key was deleted and recreated): mint once more.
    if (res.status === 401) res = await send(await this.token(true));
    if (res.status === 429) throw new GarminError("Garmin rate-limited this request; try again later.", 429);
    if (!res.ok) throw new GarminError(`Garmin ${url.pathname} failed (${res.status}).`, res.status);
    return (await res.json()) as T;
  }

  /**
   * Every weigh-in in the window. `weight/range?includeAll=true` is used rather than
   * `weight/all` because only it carries samplePk, the per-weigh-in ID that existing rows
   * are keyed on (weigh_ins.external_id).
   */
  async weighIns(start: string, end: string): Promise<RawWeighIn[]> {
    const body = await this.get<{ dailyWeightSummaries?: { allWeightMetrics?: RawWeighIn[] }[] }>(
      `/weight-service/weight/range/${start}/${end}`,
      { includeAll: true },
    );
    return (body.dailyWeightSummaries ?? []).flatMap((day) => day.allWeightMetrics ?? []);
  }

  async steps(start: string, end: string): Promise<RawStepsDay[]> {
    return this.get<RawStepsDay[]>(`/usersummary-service/stats/steps/daily/${start}/${end}`);
  }

  /** Every activity whose local start falls in the window, across as many pages as it takes. */
  async activities(start: string, end: string): Promise<RawActivity[]> {
    const all: RawActivity[] = [];
    for (let offset = 0; ; offset += ACTIVITY_PAGE_SIZE) {
      const page = await this.get<RawActivity[]>("/activitylist-service/activities/search/activities", {
        startDate: start,
        endDate: end,
        start: offset,
        limit: ACTIVITY_PAGE_SIZE,
      });
      all.push(...page);
      if (page.length < ACTIVITY_PAGE_SIZE) return all;
    }
  }
}
