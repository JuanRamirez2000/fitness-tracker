import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

/**
 * Supabase client for client components: the entry table, the quick-log sheet, and every
 * other place that mutates data straight from the browser with optimistic UI. Auth comes
 * from the same session cookies the server client reads, so RLS applies identically.
 */
export function createClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key);
}
