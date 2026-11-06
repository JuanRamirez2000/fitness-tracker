import { beforeEach, describe, expect, it, vi } from "vitest";

const getRole = vi.fn();
const generateSummaries = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getRole: () => getRole() }));
vi.mock("@/lib/summary/generate", () => ({ generateSummaries: (o: unknown) => generateSummaries(o) }));

const { POST } = await import("./route");

describe("POST /api/summary/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getRole.mockResolvedValue("owner");
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

  it("flags a summary run that throws", async () => {
    generateSummaries.mockRejectedValue(new Error("No profile row"));
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });
});
