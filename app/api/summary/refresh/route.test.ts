import { beforeEach, describe, expect, it, vi } from "vitest";

const getRole = vi.fn();
const generateSummaries = vi.fn();
const writeWeeklySummary = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getRole: () => getRole() }));
vi.mock("@/lib/summary/generate", () => ({ generateSummaries: (o: unknown) => generateSummaries(o) }));
vi.mock("@/lib/summary/weekly", () => ({ writeWeeklySummary: (o: unknown) => writeWeeklySummary(o) }));

const { POST } = await import("./route");

describe("POST /api/summary/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getRole.mockResolvedValue("owner");
    writeWeeklySummary.mockResolvedValue({ week: "2026-11-16", final: false, headline: "A steady start.", model: "gemini-3.6-flash" });
  });

  it("refuses anyone but the owner, without calling Gemini", async () => {
    getRole.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(generateSummaries).not.toHaveBeenCalled();
  });

  it("rewrites the summaries; a tab skipped for lack of data isn't a failure", async () => {
    generateSummaries.mockResolvedValue([
      { tab: "today", text: "Good day.", model: "gemini-3.6-flash" },
      { tab: "weight", text: null, model: null, skipped: "no weigh-ins yet" },
    ]);
    expect(await (await POST()).json()).toEqual({ ok: true, summaryFailed: false });
  });

  it("flags a tab whose Gemini call failed", async () => {
    generateSummaries.mockResolvedValue([{ tab: "today", text: null, model: "gemini-3.6-flash", skipped: "Gemini API 503" }]);
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });

  it("from the Progress tab rewrites only the weekly review, flagging a Gemini failure but not a quiet week", async () => {
    const weekly = () => POST(new Request("http://localhost/api/summary/refresh?scope=weekly", { method: "POST" }));
    expect(await (await weekly()).json()).toEqual({ ok: true, summaryFailed: false });
    expect(generateSummaries).not.toHaveBeenCalled();
    writeWeeklySummary.mockResolvedValue({ week: "2026-11-16", final: false, headline: null, model: null, skipped: "no training" });
    expect(await (await weekly()).json()).toEqual({ ok: true, summaryFailed: false });
    writeWeeklySummary.mockResolvedValue({ week: "2026-11-16", final: false, headline: null, model: "gemini-3.6-flash", skipped: "Gemini API 429" });
    expect(await (await weekly()).json()).toEqual({ ok: true, summaryFailed: true });
  });

  it("from any other tab leaves the weekly review alone", async () => {
    generateSummaries.mockResolvedValue([{ tab: "today", text: "Good day.", model: "gemini-3.6-flash" }]);
    await POST(new Request("http://localhost/api/summary/refresh", { method: "POST" }));
    expect(writeWeeklySummary).not.toHaveBeenCalled();
  });

  it("flags a summary run that throws", async () => {
    generateSummaries.mockRejectedValue(new Error("No profile row"));
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });
});
