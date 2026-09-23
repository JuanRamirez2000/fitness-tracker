import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { timestampSchema, uuidSchema } from "./common";
import { fetchRows } from "./paginate";

export const REQUEST_STATUSES = ["open", "planned", "done", "dismissed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** The field a person writes; status is changed separately by either account. */
export const featureRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const featureRequestRowSchema = featureRequestSchema.extend({
  id: uuidSchema,
  author_id: uuidSchema,
  status: z.enum(REQUEST_STATUSES),
  created_at: timestampSchema,
});

export type FeatureRequestInput = z.infer<typeof featureRequestSchema>;
export type FeatureRequest = z.infer<typeof featureRequestRowSchema>;

/** Both accounts read every request (see the "read all" policy), newest first. */
export function fetchFeatureRequests(supabase: SupabaseClient): Promise<FeatureRequest[]> {
  return fetchRows(featureRequestRowSchema, (from, to) =>
    supabase
      .from("feature_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to),
  );
}

export async function insertFeatureRequest(
  supabase: SupabaseClient,
  authorId: string,
  values: FeatureRequestInput,
): Promise<FeatureRequest> {
  const { data, error } = await supabase
    .from("feature_requests")
    .insert({ author_id: authorId, ...values })
    .select()
    .single();
  if (error) throw error;
  return featureRequestRowSchema.parse(data);
}

/** Either account can triage any request, including one the other person filed — "update
 * any" in supabase/schema.sql, same coach/owner parity as the rest of the app. */
export async function updateFeatureRequestStatus(
  supabase: SupabaseClient,
  id: string,
  status: RequestStatus,
): Promise<FeatureRequest> {
  const { data, error } = await supabase.from("feature_requests").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return featureRequestRowSchema.parse(data);
}
