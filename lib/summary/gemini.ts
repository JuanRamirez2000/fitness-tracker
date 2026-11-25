/**
 * The one Gemini call (REST, no SDK) behind the AI text: today, only the per-activity summaries
 * (lib/activity/summary.ts). The dashboard's daily and weekly summaries were dropped in the
 * four-tab layout (docs/plan-four-tabs.md); their stored rows stay in daily_summaries and
 * weekly_summaries.
 *
 * Free tier terms: no card, about 20 requests a day for this model (README, "AI text"), and Google
 * may use free-tier prompts and responses to improve its products, with human review. Paid-tier
 * keys don't; switching is only a billing change in AI Studio.
 */

export const SUMMARY_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

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
