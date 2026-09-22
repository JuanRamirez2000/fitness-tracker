import { cache } from "react";
import { fetchProfile, type Profile } from "@/lib/data/profiles";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  /** The signed-in person. */
  profile: Profile;
  /**
   * Whose data the dashboard shows: the viewer's own profile for an owner, or the linked
   * athlete for a coach. This is only which account's data is displayed — a coach has the
   * same read and write access as the owner (see the RLS policies in supabase/schema.sql),
   * so there is no separate read-only flag here.
   */
  athlete: Profile | null;
}

/**
 * Resolves who is signed in and whose data they are looking at. Memoized per request so the
 * layout and the page can both call it.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchProfile(supabase, user.id);
  if (profile.role === "owner") return { profile, athlete: profile };

  // RLS only lets a coach see their own coach_access rows, so this cannot leak other links.
  const { data: link, error } = await supabase
    .from("coach_access")
    .select("athlete_id")
    .eq("coach_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const athlete = link ? await fetchProfile(supabase, link.athlete_id) : null;
  return { profile, athlete };
});
