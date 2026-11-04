/**
 * The AI daily summary: today's recovery, sleep, load and weight rows -> 2 to 3 sentences from
 * Gemini (Google's free API tier) -> daily_summaries. Run once each morning by the summary cron
 * (app/api/summary/cron/route.ts) after that morning's import, or by hand
 * (`npm run summary:generate`). Never per page view.
 *
 * Free tier terms: no card, a daily request quota far above the one call made here, and Google
 * may use free-tier prompts and responses (these summary facts) to improve its products, with
 * human review. Paid-tier keys don't; switching is only a billing change in AI Studio.
 *
 * No server-only guard: scripts/summary-generate.ts runs this from the command line too.
 */
import { dailyRecoveryRowSchema, sleepNightRowSchema } from "../data/recovery";
import { dailyTrainingRowSchema } from "../data/training";
import { weightTrendRowSchema } from "../data/weight-trend";
import { addDays, type LocalDate } from "../dates/calendar";
import { todayIn } from "../dates/timezone";
import { db } from "../db";
import { SUMMARY_SYSTEM, hasEnoughForSummary, summaryFacts, summaryUserMessage, type SummaryInput } from "./prompt";

/** A stable Flash model on the Gemini API free tier. */
export const SUMMARY_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface SummaryResult {
  date: LocalDate;
  text: string | null;
  model: string | null;
  /** Why nothing was written, when nothing was. */
  skipped?: string;
}

export interface GenerateOptions {
  dryRun?: boolean;
  log?: (line: string) => void;
  /** Overrides SUMMARY_MODEL. */
  model?: string;
  /** For tests. */
  fetch?: typeof fetch;
}

/** The parts of a generateContent response read here. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

/** One generateContent call (REST, no SDK): the summary text, or why there is none. */
async function callGemini(
  model: string,
  userMessage: string,
  fetchImpl: typeof fetch,
): Promise<{ text: string; modelVersion: string } | { skipped: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Create a free key at aistudio.google.com/apikey.");

  const res = await fetchImpl(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SUMMARY_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        // Short output, but thinking tokens share this budget.
        maxOutputTokens: 2000,
        // A short summary of given numbers needs little reasoning.
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    }),
  });
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

/** Today's rows, plus enough history for the week-over-week weight change. */
async function loadInput(userId: string, today: LocalDate): Promise<SummaryInput> {
  const sql = db();
  const from = addDays(today, -14);
  const [recovery, sleep, training, weightTrend] = await Promise.all([
    sql`select * from daily_recovery where user_id = ${userId} and local_date between ${from} and ${today} order by local_date`,
    sql`select * from sleep_nights where user_id = ${userId} and local_date between ${from} and ${today} order by local_date`,
    sql`select * from daily_training where user_id = ${userId} and local_date between ${from} and ${today} order by local_date`,
    sql`select * from weight_trend where user_id = ${userId} and local_date between ${from} and ${today} order by local_date`,
  ]);
  return {
    today,
    recovery: recovery.map((r) => dailyRecoveryRowSchema.parse(r)),
    sleep: sleep.map((r) => sleepNightRowSchema.parse(r)),
    training: training.map((r) => dailyTrainingRowSchema.parse(r)),
    weightTrend: weightTrend.map((r) => weightTrendRowSchema.parse(r)),
  };
}

/** Writes (or, with dryRun, prints) today's summary. */
export async function generateDailySummary(options: GenerateOptions = {}): Promise<SummaryResult> {
  const { dryRun = false, log = () => {} } = options;
  const sql = db();
  const [profile] = await sql<{ id: string; timezone: string }[]>`select id, timezone from profiles order by created_at limit 1`;
  if (!profile) throw new Error("No profile row in the database yet. Run `npm run db:import` first.");

  const today = todayIn(profile.timezone);
  const facts = summaryFacts(await loadInput(profile.id, today));
  log(`Facts for ${today}: ${JSON.stringify(facts)}`);
  if (!hasEnoughForSummary(facts)) {
    log("Not enough data for today yet (no readiness or sleep); nothing written.");
    return { date: today, text: null, model: null, skipped: "no readiness or sleep for today yet" };
  }

  const model = options.model ?? SUMMARY_MODEL;
  const call = await callGemini(model, summaryUserMessage(facts), options.fetch ?? fetch);
  if ("skipped" in call) {
    log(`${call.skipped}; nothing written.`);
    return { date: today, text: null, model, skipped: call.skipped };
  }
  const { text, modelVersion } = call;

  log(`${modelVersion}: ${text}`);
  if (!dryRun) {
    await sql`
      insert into daily_summaries (user_id, local_date, text, model, generated_at)
      values (${profile.id}, ${today}, ${text}, ${modelVersion}, now())
      on conflict (user_id, local_date)
      do update set text = excluded.text, model = excluded.model, generated_at = excluded.generated_at`;
  }
  return { date: today, text, model: modelVersion };
}
