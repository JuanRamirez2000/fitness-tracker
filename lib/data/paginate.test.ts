import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchRows } from "./paginate";

const row = z.object({ n: z.number() });

/** A fake query over `total` rows, honoring .range(from, to) like PostgREST does. */
function fakeTable(total: number) {
  return vi.fn(async (from: number, to: number) => ({
    data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => ({
      n: from + i,
    })),
    error: null,
  }));
}

describe("fetchRows", () => {
  it("returns a short result from a single request", async () => {
    const page = fakeTable(12);
    expect(await fetchRows(row, page)).toHaveLength(12);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it("keeps reading past the 1000-row cap and preserves order", async () => {
    const page = fakeTable(2500);
    const rows = await fetchRows(row, page);
    expect(rows).toHaveLength(2500);
    expect(rows.map((r) => r.n)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("stops after an empty page when the total is an exact multiple of the page size", async () => {
    const page = fakeTable(2000);
    expect(await fetchRows(row, page)).toHaveLength(2000);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("returns an empty list for an empty table", async () => {
    expect(await fetchRows(row, fakeTable(0))).toEqual([]);
  });

  it("treats null data as empty", async () => {
    expect(await fetchRows(row, async () => ({ data: null, error: null }))).toEqual([]);
  });

  it("throws the query error instead of returning partial rows", async () => {
    const error = { message: "permission denied", details: "", hint: "", code: "42501" };
    await expect(
      fetchRows(row, async () => ({ data: null, error: error as PostgrestError })),
    ).rejects.toBe(error);
  });

  it("fails loudly when a row does not match the schema", async () => {
    await expect(
      fetchRows(row, async () => ({ data: [{ n: "not a number" }], error: null })),
    ).rejects.toThrow();
  });
});
