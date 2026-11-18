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
      { tab: "training", text: "Good day.", model: "gemini-3.6-flash" },
      { tab: "weight", text: null, model: null, skipped: "no weigh-ins yet" },
    ]);
    expect(await (await POST()).json()).toEqual({ ok: true, summaryFailed: false });
  });

  it("flags a tab whose Gemini call failed", async () => {
    generateSummaries.mockResolvedValue([{ tab: "training", text: null, model: "gemini-3.6-flash", skipped: "Gemini API 503" }]);
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });

  it("with ?scope=weekly rewrites only the weekly review, flagging a Gemini failure but not a quiet week", async () => {
    const weekly = () => POST(new Request("http://localhost/api/summary/refresh?scope=weekly", { method: "POST" }));
    expect(await (await weekly()).json()).toEqual({ ok: true, summaryFailed: false });
    expect(generateSummaries).not.toHaveBeenCalled();
    writeWeeklySummary.mockResolvedValue({ week: "2026-11-16", final: false, headline: null, model: null, skipped: "no training" });
    expect(await (await weekly()).json()).toEqual({ ok: true, summaryFailed: false });
    writeWeeklySummary.mockResolvedValue({ week: "2026-11-16", final: false, headline: null, model: "gemini-3.6-flash", skipped: "Gemini API 429" });
    expect(await (await weekly()).json()).toEqual({ ok: true, summaryFailed: true });
  });

  it("from the Training tab rewrites its summary and the weekly review; from Weight, only its summary", async () => {
    generateSummaries.mockResolvedValue([{ tab: "training", text: "Good week.", model: "gemini-3.6-flash" }]);
    await POST(new Request("http://localhost/api/summary/refresh?scope=training", { method: "POST" }));
    expect(generateSummaries).toHaveBeenLastCalledWith(expect.objectContaining({ tabs: ["training"] }));
    expect(writeWeeklySummary).toHaveBeenCalledTimes(1);
    await POST(new Request("http://localhost/api/summary/refresh?scope=weight", { method: "POST" }));
    expect(generateSummaries).toHaveBeenLastCalledWith(expect.objectContaining({ tabs: ["weight"] }));
    expect(writeWeeklySummary).toHaveBeenCalledTimes(1);
  });

  it("flags a summary run that throws", async () => {
    generateSummaries.mockRejectedValue(new Error("No profile row"));
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });
});
