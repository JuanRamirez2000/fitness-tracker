import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RETRY_DELAYS_MS, callGemini } from "./generate";

const ok = () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "A summary." }] }, finishReason: "STOP" }], modelVersion: "m" }), {
    status: 200,
  });
const status = (code: number) => new Response(JSON.stringify({ error: { code } }), { status: code });

/** A fetch that answers with each response in turn, counting calls. */
function scripted(...responses: (() => Response)[]) {
  let calls = 0;
  const fetchImpl = (async () => responses[Math.min(calls++, responses.length - 1)]()) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("callGemini", () => {
  const saved = process.env.GEMINI_API_KEY;
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });
  afterEach(() => {
    process.env.GEMINI_API_KEY = saved;
  });

  const waits: number[] = [];
  const wait = async (ms: number) => {
    waits.push(ms);
  };
  beforeEach(() => {
    waits.length = 0;
  });

  it("retries a busy answer and returns the text once Gemini recovers", async () => {
    const f = scripted(() => status(503), () => status(429), ok);
    await expect(callGemini("m", "sys", "user", f.fetchImpl, wait)).resolves.toEqual({ text: "A summary.", modelVersion: "m" });
    expect(f.calls()).toBe(3);
    expect(waits).toEqual(RETRY_DELAYS_MS);
  });

  it("gives up after the retries with the last error", async () => {
    const f = scripted(() => status(503));
    await expect(callGemini("m", "sys", "user", f.fetchImpl, wait)).rejects.toThrow("Gemini API 503");
    expect(f.calls()).toBe(RETRY_DELAYS_MS.length + 1);
  });

  it("doesn't retry an error that won't pass", async () => {
    const f = scripted(() => status(400), ok);
    await expect(callGemini("m", "sys", "user", f.fetchImpl, wait)).rejects.toThrow("Gemini API 400");
    expect(f.calls()).toBe(1);
    expect(waits).toEqual([]);
  });
});

describe("parseTrainingAnswer", () => {
  it("takes the summary and valid sessions, dropping malformed ones", async () => {
    const { parseTrainingAnswer } = await import("./generate");
    const answer = parseTrainingAnswer(
      JSON.stringify({
        summary: " Four sentences. ",
        next_sessions: [
          { date: "2026-11-13", title: "Base", details: "Easy spin.", source: "garmin" },
          { date: "soon", title: "Bad", details: "x", source: "garmin" },
        ],
      }),
    );
    expect(answer).toEqual({ text: "Four sentences.", nextSessions: [{ date: "2026-11-13", title: "Base", details: "Easy spin.", source: "garmin" }] });
    expect(parseTrainingAnswer("not json")).toBeNull();
    expect(parseTrainingAnswer(JSON.stringify({ next_sessions: [] }))).toBeNull();
  });
});
