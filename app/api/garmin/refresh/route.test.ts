import { beforeEach, describe, expect, it, vi } from "vitest";

const getRole = vi.fn();
const importGarmin = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getRole: () => getRole() }));
vi.mock("@/lib/garmin/import", () => ({ importGarmin: (o: unknown) => importGarmin(o) }));

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
  });

  it("imports today and answers without waiting on summaries", async () => {
    const res = await POST();
    expect(await res.json()).toEqual({ ok: true, result: { imported: 3 } });
    expect(importGarmin).toHaveBeenCalledWith({ window: { kind: "today" } });
  });

  it("reports a failed import", async () => {
    importGarmin.mockRejectedValue(new Error("rate limited"));
    const res = await POST();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ ok: false });
  });
});
