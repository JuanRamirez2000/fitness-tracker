import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOwnerProfile = vi.fn();
const fetchRecovery = vi.fn();
const importGarmin = vi.fn();
const writeMissingActivitySummaries = vi.fn();
vi.mock("@/lib/data/queries", () => ({
  fetchOwnerProfile: () => fetchOwnerProfile(),
  fetchRecovery: (...a: unknown[]) => fetchRecovery(...a),
}));
vi.mock("@/lib/garmin/import", () => ({ importGarmin: (o: unknown) => importGarmin(o) }));
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
    fetchRecovery.mockResolvedValue([]);
    importGarmin.mockResolvedValue({});
    writeMissingActivitySummaries.mockResolvedValue({ written: 0, failed: 0 });
  });

  it("refuses a caller without the cron secret", async () => {
    expect((await call("", "wrong")).status).toBe(401);
    expect(importGarmin).not.toHaveBeenCalled();
  });

  it("as the fallback, skips the import once this morning's readiness is in", async () => {
    fetchRecovery.mockResolvedValue([{ readiness_morning_score: 71, readiness_score: 68 }]);
    expect(await (await call()).json()).toMatchObject({ ok: true, imported: { skipped: expect.any(String) } });
    expect(importGarmin).not.toHaveBeenCalled();
    expect(writeMissingActivitySummaries).toHaveBeenCalledOnce();
  });

  it("as the fallback, imports when the readiness isn't in", async () => {
    fetchRecovery.mockResolvedValue([{ readiness_morning_score: null, readiness_score: null }]);
    await call();
    expect(importGarmin).toHaveBeenCalledOnce();
  });

  it("after the import, always imports and writes the activity summaries", async () => {
    fetchRecovery.mockResolvedValue([{ readiness_morning_score: 71, readiness_score: 68 }]);
    await call("?after=import");
    expect(fetchRecovery).not.toHaveBeenCalled();
    expect(importGarmin).toHaveBeenCalledOnce();
    expect(writeMissingActivitySummaries).toHaveBeenCalledOnce();
  });

  it("still writes the activity summaries when the import fails", async () => {
    importGarmin.mockRejectedValue(new Error("rate limited"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await call("?after=import")).json()).toMatchObject({ ok: false, imported: { error: "rate limited" } });
    expect(writeMissingActivitySummaries).toHaveBeenCalledOnce();
  });
});
