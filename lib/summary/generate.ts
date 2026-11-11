/**
 * The AI summaries, one per dashboard tab: each tab's rows -> 4 sentences from Gemini (plus the
 * Training tab's "Next up" sessions) (Google's free API tier) -> daily_summaries. Daily feel (lib/summary/prompt.ts), Weight
 * (weight.ts) and Training (training.ts) each have their own facts and instructions. Run once
 * each morning by the summary cron (app/api/summary/cron/route.ts) after that morning's import,
 * again after each press of the owner's Refresh button (app/api/summary/refresh/route.ts), or by
 * hand (`npm run summary:generate`). Never per page view.
 *
 * Free tier terms: no card, a daily request quota far above the one call made here, and Google
 * may use free-tier prompts and responses (these summary facts) to improve its products, with
 * human review. Paid-tier keys don't; switching is only a billing change in AI Studio.
 *
 * No server-only guard: scripts/summary-generate.ts runs this from the command line too.
 */
import type { TabKey } from "../dashboard/types";
import { activityRowSchema } from "../data/activities";
import { nextSessionSchema, plannedWorkoutRowSchema, type NextSession } from "../data/planned";
import { profileSchema, type Profile } from "../data/profiles";
import { dailyRecoveryRowSchema, sleepNightRowSchema } from "../data/recovery";
import { dailyTrainingRowSchema } from "../data/training";
import { bodyCompositionDaySchema } from "../data/weigh-ins";
import { weightTrendRowSchema } from "../data/weight-trend";
import { addDays, type LocalDate } from "../dates/calendar";
import { todayIn } from "../dates/timezone";
import { db } from "../db";
import { SUMMARY_SYSTEM, hasEnoughForSummary, summaryFacts, summaryUserMessage } from "./prompt";
import { TRAINING_SYSTEM, hasEnoughForTrainingSummary, trainingFacts } from "./training";
import { WEIGHT_SYSTEM, hasEnoughForWeightSummary, weightFacts } from "./weight";

/** A stable Flash model on the Gemini API free tier. */
export const SUMMARY_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface SummaryResult {
  tab: TabKey;
  date: LocalDate;
  text: string | null;
  model: string | null;
  /** Why nothing was written, when nothing was. */
  skipped?: string;
}

export interface GenerateOptions {
  /** Which tabs to write (default: all three). */
  tabs?: readonly TabKey[];
  dryRun?: boolean;
  log?: (line: string) => void;
  /** Overrides SUMMARY_MODEL. */
  model?: string;
  /** For tests. */
  fetch?: typeof fetch;
  /** For tests: replaces the pause before a retry. */
  wait?: (ms: number) => Promise<void>;
}

/** The parts of a generateContent response read here. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

/** Gemini statuses worth another try, and the waits before each retry. */
const TRANSIENT_STATUSES = new Set([429, 500, 503]);
export const RETRY_DELAYS_MS = [5_000, 20_000];

/** One generateContent call (REST, no SDK): the summary text, or why there is none. Retries
 * a busy or rate-limited answer twice. */
export async function callGemini(
  model: string,
  system: string,
  userMessage: string,
  fetchImpl: typeof fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  /** A JSON schema for a structured answer (Gemini's responseSchema); the text is then JSON. */
  responseSchema?: Record<string, unknown>,
): Promise<{ text: string; modelVersion: string } | { skipped: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Create a free key at aistudio.google.com/apikey.");

  const request = () => fetchImpl(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        // Short output, but thinking tokens share this budget.
        maxOutputTokens: 2000,
        // A short summary of given numbers needs little reasoning.
        thinkingConfig: { thinkingLevel: "LOW" },
        ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
      },
    }),
  });
  // The free tier answers 503 ("high demand") and 429 at busy times; both pass in seconds.
  let res = await request();
  for (const delay of RETRY_DELAYS_MS) {
    if (res.ok || !TRANSIENT_STATUSES.has(res.status)) break;
    await res.body?.cancel();
    await wait(delay);
    res = await request();
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.promptFeedback?.blockReason) return { skipped: `the prompt was blocked (${data.promptFeedback.blockReason})` };
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .flatMap((part) => (part.text && !part.thought ? [part.text] : []))
    .join("")
    .trim();
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    return { skipped: `the model stopped early (${candidate.finishReason})` };
  }
  if (!text) return { skipped: "empty response" };
  return { text, modelVersion: data.modelVersion ?? model };
}

/** Every row any tab's facts read, loaded once for all three. */
async function loadRows(profile: Profile, today: LocalDate) {
  const sql = db();
  const recent = addDays(today, -14);
  const month = addDays(today, -40);
  const [recovery, sleep, training, weightTrend, bodyComposition, activities, planned] = await Promise.all([
    sql`select * from daily_recovery where user_id = ${profile.id} and local_date between ${recent} and ${today} order by local_date`,
    sql`select * from sleep_nights where user_id = ${profile.id} and local_date between ${recent} and ${today} order by local_date`,
    sql`select * from daily_training where user_id = ${profile.id} and local_date between ${month} and ${today} order by local_date`,
    sql`select * from weight_trend where user_id = ${profile.id} and local_date <= ${today} order by local_date`,
    sql`select distinct on (local_date) local_date, weight_lb, body_fat_pct, muscle_mass_lb, bone_mass_lb, body_water_pct
        from weigh_ins where user_id = ${profile.id} and body_fat_pct is not null and local_date <= ${today}
        order by local_date, measured_at`,
    // 90 days of activities: the training facts look back that far for the best 20-minute power.
    sql`select * from activities where user_id = ${profile.id} and local_date between ${addDays(today, -90)} and ${today} order by started_at`,
    sql`select * from planned_workouts where user_id = ${profile.id} and local_date >= ${today} order by local_date, workout_uuid`,
  ]);
  return {
    recovery: recovery.map((r) => dailyRecoveryRowSchema.parse(r)),
    sleep: sleep.map((r) => sleepNightRowSchema.parse(r)),
    training: training.map((r) => dailyTrainingRowSchema.parse(r)),
    weightTrend: weightTrend.map((r) => weightTrendRowSchema.parse(r)),
    bodyComposition: bodyComposition.map((r) => bodyCompositionDaySchema.parse(r)),
    activities: activities.map((r) => activityRowSchema.parse(r)),
    planned: planned.map((r) => plannedWorkoutRowSchema.parse(r)),
  };
}

type Rows = Awaited<ReturnType<typeof loadRows>>;

/** Each tab's facts, instructions, and what it needs before it's worth writing. */
/** The Training tab's structured answer: the 4 sentences and the "Next up" sessions. */
const TRAINING_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    next_sessions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          title: { type: "string" },
          details: { type: "string" },
          source: { type: "string", enum: ["garmin", "suggested"] },
        },
        required: ["date", "title", "details", "source"],
      },
    },
  },
  required: ["summary", "next_sessions"],
};

/** A structured Training answer -> its text and sessions; null when it isn't valid JSON of that shape. */
export function parseTrainingAnswer(text: string): { text: string; nextSessions: NextSession[] } | null {
  try {
    const parsed = JSON.parse(text) as { summary?: unknown; next_sessions?: unknown };
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;
    const sessions = Array.isArray(parsed.next_sessions) ? parsed.next_sessions.flatMap((s) => {
      const ok = nextSessionSchema.safeParse(s);
      return ok.success ? [ok.data] : [];
    }) : [];
    return { text: parsed.summary.trim(), nextSessions: sessions.slice(0, 3) };
  } catch {
    return null;
  }
}

const TABS: Record<TabKey, { system: string; facts: (rows: Rows, profile: Profile, today: LocalDate) => Record<string, unknown>; enough: (facts: Record<string, unknown>) => boolean; missing: string; schema?: Record<string, unknown> }> = {
  today: {
    system: SUMMARY_SYSTEM,
    facts: (rows, _profile, today) => summaryFacts({ today, ...rows }),
    enough: hasEnoughForSummary,
    missing: "no readiness or sleep for today yet",
  },
  weight: {
    system: WEIGHT_SYSTEM,
    facts: (rows, profile, today) => weightFacts({ today, profile, weightTrend: rows.weightTrend, bodyComposition: rows.bodyComposition }),
    enough: hasEnoughForWeightSummary,
    missing: "no weigh-in in the last few days",
  },
  training: {
    system: TRAINING_SYSTEM,
    facts: (rows, profile, today) => trainingFacts({ today, profile, activities: rows.activities, training: rows.training, planned: rows.planned }),
    enough: hasEnoughForTrainingSummary,
    missing: "no recent riding, running or training load",
    schema: TRAINING_RESPONSE_SCHEMA,
  },
};

export const SUMMARY_TABS = Object.keys(TABS) as TabKey[];

/** Writes (or, with dryRun, prints) today's summary for each tab. One tab failing to have
 * enough data, or whose Gemini call fails, skips only that tab. */
export async function generateSummaries(options: GenerateOptions = {}): Promise<SummaryResult[]> {
  const { dryRun = false, log = () => {}, tabs = SUMMARY_TABS } = options;
  const sql = db();
  const [row] = await sql`
    select id, display_name, timezone, program_start_date, goal_weight_lb, goal_pace_lb_per_week,
           start_weight_lb, shot_weekday, hr_zone_bounds, hr_zone_bounds_cycling
    from profiles order by created_at limit 1`;
  if (!row) throw new Error("No profile row in the database yet. Run `npm run db:import` first.");
  const profile = profileSchema.parse(row);

  const today = todayIn(profile.timezone);
  const rows = await loadRows(profile, today);
  const model = options.model ?? SUMMARY_MODEL;

  // The tabs run side by side: a press of Refresh waits for the slowest Gemini call, not the
  // sum of three. Results keep the order of `tabs`.
  async function writeTab(tab: TabKey): Promise<SummaryResult> {
    const spec = TABS[tab];
    const facts = spec.facts(rows, profile, today);
    log(`[${tab}] facts for ${today}: ${JSON.stringify(facts)}`);
    if (!spec.enough(facts)) {
      log(`[${tab}] ${spec.missing}; nothing written.`);
      return { tab, date: today, text: null, model: null, skipped: spec.missing };
    }

    let call: Awaited<ReturnType<typeof callGemini>>;
    try {
      call = await callGemini(model, spec.system, summaryUserMessage(facts), options.fetch ?? fetch, options.wait, spec.schema);
    } catch (err) {
      // One tab's API failure (Gemini still busy after the retries) leaves the others to run.
      call = { skipped: err instanceof Error ? err.message : String(err) };
    }
    if ("skipped" in call) {
      log(`[${tab}] ${call.skipped}; nothing written.`);
      return { tab, date: today, text: null, model, skipped: call.skipped };
    }
    let text = call.text;
    let nextSessions: NextSession[] | null = null;
    if (spec.schema) {
      const answer = parseTrainingAnswer(call.text);
      if (!answer) {
        log(`[${tab}] the answer wasn't the expected JSON; nothing written.`);
        return { tab, date: today, text: null, model, skipped: "the answer wasn't the expected JSON" };
      }
      text = answer.text;
      nextSessions = answer.nextSessions;
    }
    log(`[${tab}] ${call.modelVersion}: ${text}${nextSessions ? `\n[${tab}] next up: ${JSON.stringify(nextSessions)}` : ""}`);
    if (!dryRun) {
      const sessions = nextSessions ? sql.json(nextSessions) : null;
      await sql`
        insert into daily_summaries (user_id, local_date, tab, text, model, next_sessions, generated_at)
        values (${profile.id}, ${today}, ${tab}, ${text}, ${call.modelVersion}, ${sessions}, now())
        on conflict (user_id, local_date, tab)
        do update set text = excluded.text, model = excluded.model, next_sessions = excluded.next_sessions, generated_at = excluded.generated_at`;
    }
    return { tab, date: today, text, model: call.modelVersion };
  }

  return Promise.all(tabs.map(writeTab));
}
