import { cache } from "react";
import { fetchProfile, profileSchema, type Profile } from "@/lib/data/profiles";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { isAuthDisabled } from "@/lib/supabase/dev-login";

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
  if (isAuthDisabled()) return getOwnerViewerViaServiceRole();

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

/**
 * The DISABLE_AUTH path (see dev-login.ts's isAuthDisabled doc comment): no signed-in user
 * exists, so instead of resolving a session, this reads the single owner profile directly via
 * the service-role key and presents them as both the signed-in viewer and the athlete — the
 * same shape a real owner session already produces above.
 */
async function getOwnerViewerViaServiceRole(): Promise<Viewer | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "owner").single();
  if (error) throw error;
  const profile = profileSchema.parse(data);
  return { profile, athlete: profile };
}
