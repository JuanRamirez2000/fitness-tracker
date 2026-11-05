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
import { dayChunks, eachDay } from "../dates/calendar";
import type { RawActivityDetails, RawActivityRecord } from "./details";
import type {
  RawActivity,
  RawFitnessAge,
  RawHrvDay,
  RawHrZones,
  RawSleepNight,
  RawStepsDay,
  RawUserSummary,
  RawWeighIn,
} from "./map";

const BASE_URL = "https://personal.connectapi.garmin.com";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";
/** Mint a new token this long before the old one expires. */
const EXPIRY_MARGIN_MS = 10 * 60_000;
/** Used when the token's own expiry can't be read: Garmin documents 24 hours. */
const FALLBACK_LIFETIME_MS = 23 * 60 * 60_000;
const ACTIVITY_PAGE_SIZE = 100;
/** Samples asked for per activity; Garmin thins longer activities down to this. */
const ACTIVITY_DETAIL_SAMPLES = 2000;
/** Per-request day limits, measured against the Personal API (docs/garmin-fields.md). */
const STEPS_MAX_DAYS = 28;
const SLEEP_MAX_DAYS = 31;
const HRV_MAX_DAYS = 31;
/** Pause between one-day-per-call requests during a backfill. */
const PER_DAY_PAUSE_MS = 250;

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
    // Some endpoints answer a day with no data with an empty body rather than JSON.
    const text = await res.text();
    return (text.trim() ? JSON.parse(text) : null) as T;
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

  /** Daily steps, in 28-day requests (a longer one returns 400). */
  async steps(start: string, end: string): Promise<RawStepsDay[]> {
    const all: RawStepsDay[] = [];
    for (const { from, to } of dayChunks(start, end, STEPS_MAX_DAYS)) {
      all.push(...(await this.get<RawStepsDay[]>(`/usersummary-service/stats/steps/daily/${from}/${to}`)));
    }
    return all;
  }

  /** Every night that ended in the window (calendarDate = wake-up day). */
  async sleep(start: string, end: string): Promise<RawSleepNight[]> {
    const all: RawSleepNight[] = [];
    for (const { from, to } of dayChunks(start, end, SLEEP_MAX_DAYS)) {
      const page = await this.get<RawSleepNight[] | null>("/sleep-service/sleep/dailySleepSummariesByDate", {
        startDate: from,
        endDate: to,
      });
      all.push(...(page ?? []));
    }
    return all;
  }

  async hrv(start: string, end: string): Promise<RawHrvDay[]> {
    const all: RawHrvDay[] = [];
    for (const { from, to } of dayChunks(start, end, HRV_MAX_DAYS)) {
      const body = await this.get<{ hrvSummaries?: RawHrvDay[] } | null>(`/hrv-service/hrv/daily/${from}/${to}`);
      all.push(...(body?.hrvSummaries ?? []));
    }
    return all;
  }

  /** Resting HR, stress and Body Battery (incl. at wake): one request per day. */
  async userSummaries(start: string, end: string): Promise<RawUserSummary[]> {
    const all: RawUserSummary[] = [];
    const days = eachDay(start, end);
    for (const [i, day] of days.entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, PER_DAY_PAUSE_MS));
      const summary = await this.get<RawUserSummary | null>("/usersummary-service/usersummary/daily", { calendarDate: day });
      if (summary) all.push({ ...summary, calendarDate: summary.calendarDate ?? day });
    }
    return all;
  }

  /** Fitness age as of each day in the window: one request per day. */
  async fitnessAges(start: string, end: string): Promise<{ date: string; raw: RawFitnessAge | null }[]> {
    const all: { date: string; raw: RawFitnessAge | null }[] = [];
    for (const [i, day] of eachDay(start, end).entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, PER_DAY_PAUSE_MS));
      all.push({ date: day, raw: await this.get<RawFitnessAge | null>(`/fitnessage-service/fitnessage/v2/${day}`, { fullHistoryScan: true }) });
    }
    return all;
  }

  /** The athlete's HR zone settings, one entry per sport. */
  async hrZones(): Promise<RawHrZones[]> {
    return (await this.get<RawHrZones[] | null>("/biometric-service/heartRateZones/v2", { generateDefaults: true })) ?? [];
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

  /**
   * One activity's samples: every metric the watch recorded, about one a second, which Garmin
   * thins itself past maxChartSize (a two-hour run still gets a sample every few seconds).
   */
  async activityDetails(activityId: string): Promise<RawActivityDetails | null> {
    return this.get<RawActivityDetails | null>(`/activity-service/activity/${activityId}/details`, {
      maxChartSize: ACTIVITY_DETAIL_SAMPLES,
      maxPolylineSize: 0,
    });
  }

  /** One activity's record: location, logged feel and RPE, and split summaries by type. */
  async activityRecord(activityId: string): Promise<RawActivityRecord | null> {
    return this.get<RawActivityRecord | null>(`/activity-service/activity/${activityId}`);
  }
}
