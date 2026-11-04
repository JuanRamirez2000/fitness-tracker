/**
 * The AI daily summary: today's recovery, sleep, load and weight rows -> 2 to 3 sentences from
 * Claude -> daily_summaries. Run once each morning by the summary cron
 * (app/api/summary/cron/route.ts) after that morning's import, or by hand
 * (`npm run summary:generate`). Never per page view.
 *
 * No server-only guard: scripts/summary-generate.ts runs this from the command line too.
 */
import Anthropic from "@anthropic-ai/sdk";
import { dailyRecoveryRowSchema, sleepNightRowSchema } from "../data/recovery";
import { dailyTrainingRowSchema } from "../data/training";
import { weightTrendRowSchema } from "../data/weight-trend";
import { addDays, type LocalDate } from "../dates/calendar";
import { todayIn } from "../dates/timezone";
import { db } from "../db";
import { SUMMARY_SYSTEM, hasEnoughForSummary, summaryFacts, summaryUserMessage, type SummaryInput } from "./prompt";

export const SUMMARY_MODEL = "claude-opus-5-5";

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
  client?: Anthropic;
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

  const client = options.client ?? new Anthropic();
  const response = await client.beta.messages.create({
    model: SUMMARY_MODEL,
    // Short output, but adaptive thinking shares this budget.
    max_tokens: 4000,
    // A short summary of given numbers: low effort holds quality at a fraction of the cost.
    output_config: { effort: "low" },
    // If a safety classifier declines, the API re-runs the request on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: summaryUserMessage(facts) }],
  });

  if (response.stop_reason === "refusal") {
    log(`Declined (${response.stop_details?.category ?? "no category"}); nothing written.`);
    return { date: today, text: null, model: response.model, skipped: "the model declined" };
  }
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) return { date: today, text: null, model: response.model, skipped: "empty response" };

  log(`${response.model}: ${text}`);
  if (!dryRun) {
    await sql`
      insert into daily_summaries (user_id, local_date, text, model, generated_at)
      values (${profile.id}, ${today}, ${text}, ${response.model}, now())
      on conflict (user_id, local_date)
      do update set text = excluded.text, model = excluded.model, generated_at = excluded.generated_at`;
  }
  return { date: today, text, model: response.model };
}
