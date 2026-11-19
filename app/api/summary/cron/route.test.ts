import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOwnerProfile = vi.fn();
const fetchDailySummary = vi.fn();
const importGarmin = vi.fn();
const generateSummaries = vi.fn();
const writeWeeklySummary = vi.fn();
const writeMissingActivitySummaries = vi.fn();
vi.mock("@/lib/data/queries", () => ({
  fetchOwnerProfile: () => fetchOwnerProfile(),
  fetchDailySummary: (...a: unknown[]) => fetchDailySummary(...a),
}));
vi.mock("@/lib/garmin/import", () => ({ importGarmin: (o: unknown) => importGarmin(o) }));
vi.mock("@/lib/summary/generate", () => ({ generateSummaries: (o: unknown) => generateSummaries(o) }));
vi.mock("@/lib/summary/weekly", () => ({ writeWeeklySummary: (o: unknown) => writeWeeklySummary(o) }));
vi.mock("@/lib/activity/summary", () => ({ writeMissingActivitySummaries: (...a: unknown[]) => writeMissingActivitySummaries(...a) }));

const { GET } = await import("./route");

const call = (query = "", secret = "s3cret") =>
  GET(new NextRequest(`https://tracker.test/api/summary/cron${query}`, { headers: { authorization: `Bearer ${secret}` } }));

describe("GET /api/summary/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.spyOn(console, "log").mockImplementation(() => {});
    fetchOwnerProfile.mockResolvedValue({ id: "u1", timezone: "America/Los_Angeles" });
    importGarmin.mockResolvedValue({});
    generateSummaries.mockResolvedValue([]);
    writeWeeklySummary.mockResolvedValue({ headline: null, model: null });
    writeMissingActivitySummaries.mockResolvedValue({ written: 0, failed: 0 });
  });

  it("refuses a caller without the cron secret", async () => {
    expect((await call("", "wrong")).status).toBe(401);
    expect(generateSummaries).not.toHaveBeenCalled();
  });

  it("as the fallback, does nothing once today's summaries exist", async () => {
    fetchDailySummary.mockResolvedValue({ text: "Written at 8." });
    expect(await (await call()).json()).toMatchObject({ ok: true, skipped: expect.any(String) });
    expect(importGarmin).not.toHaveBeenCalled();
    expect(generateSummaries).not.toHaveBeenCalled();
  });

  it("as the fallback, writes them when the import never called", async () => {
    fetchDailySummary.mockResolvedValue(null);
    await call();
    expect(generateSummaries).toHaveBeenCalledOnce();
  });

  it("after the import, always writes them", async () => {
    fetchDailySummary.mockResolvedValue({ text: "From a Refresh." });
    await call("?after=import");
    expect(fetchDailySummary).not.toHaveBeenCalled();
    expect(generateSummaries).toHaveBeenCalledOnce();
    expect(writeWeeklySummary).toHaveBeenCalledOnce();
  });
});
