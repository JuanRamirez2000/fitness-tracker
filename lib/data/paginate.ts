import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

// Supabase truncates a response at 1000 rows without saying so. "All time" on the table or
// a long heatmap window would otherwise lose rows silently once history grows.
const PAGE_SIZE = 1000;

type Page = PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>;

/**
 * Reads every page of a query and validates each row. `page` must add a stable `.order()`
 * and apply `.range(from, to)`; the range has to come after any filters.
 */
export async function fetchRows<T>(
  schema: z.ZodType<T>,
  page: (from: number, to: number) => Page,
): Promise<T[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows.map((row) => schema.parse(row));
}
