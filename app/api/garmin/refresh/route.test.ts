import { beforeEach, describe, expect, it, vi } from "vitest";

const getRole = vi.fn();
const importGarmin = vi.fn();
const generateSummaries = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getRole: () => getRole() }));
vi.mock("@/lib/garmin/import", () => ({ importGarmin: (o: unknown) => importGarmin(o) }));
vi.mock("@/lib/summary/generate", () => ({ generateSummaries: (o: unknown) => generateSummaries(o) }));

const { POST } = await import("./route");

describe("POST /api/garmin/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getRole.mockResolvedValue("owner");
    importGarmin.mockResolvedValue({ imported: 3 });
  });

  it("refuses anyone but the owner, without importing", async () => {
    getRole.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(importGarmin).not.toHaveBeenCalled();
    expect(generateSummaries).not.toHaveBeenCalled();
  });

  it("rewrites the summaries after a successful import", async () => {
    generateSummaries.mockResolvedValue([
      { tab: "today", text: "Good day.", model: "gemini-3.6-flash" },
      { tab: "weight", text: null, model: null, skipped: "no weigh-ins yet" },
    ]);
    const res = await POST();
    expect(await res.json()).toEqual({ ok: true, result: { imported: 3 }, summaryFailed: false });
    expect(importGarmin.mock.invocationCallOrder[0]).toBeLessThan(generateSummaries.mock.invocationCallOrder[0]);
  });

  it("flags a tab whose Gemini call failed, but still reports the import as done", async () => {
    generateSummaries.mockResolvedValue([{ tab: "today", text: null, model: "gemini-3.6-flash", skipped: "Gemini API 503" }]);
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });

  it("flags a summary run that throws", async () => {
    generateSummaries.mockRejectedValue(new Error("No profile row"));
    expect(await (await POST()).json()).toMatchObject({ ok: true, summaryFailed: true });
  });

  it("writes no summaries when the import fails", async () => {
    importGarmin.mockRejectedValue(new Error("rate limited"));
    const res = await POST();
    expect(res.status).toBe(502);
    expect(generateSummaries).not.toHaveBeenCalled();
  });
});
