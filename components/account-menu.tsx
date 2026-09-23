"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { SETTINGS_FIELDS } from "@/lib/dashboard/settings-fields";
import { profileSettingsSchema, updateProfile, type Profile, type ProfileSettings } from "@/lib/data/profiles";
import { createClient } from "@/lib/supabase/browser";
import { EntryFormDialog } from "./dashboard/entry-form-dialog";

interface AccountMenuProps {
  initials: string;
  displayName: string;
  roleLabel: string;
  /** Whose settings this menu edits — the viewer's own profile for an owner, or the linked
   * athlete for a coach (same account the rest of the dashboard shows; see lib/auth/viewer.ts).
   * Null only while a coach has no athlete linked yet, when there is nothing to edit. */
  athlete: Profile | null;
}

function toSettings(profile: Profile): ProfileSettings {
  return {
    display_name: profile.display_name,
    timezone: profile.timezone,
    goal_weight_lb: profile.goal_weight_lb,
    goal_pace_lb_per_week: profile.goal_pace_lb_per_week,
    start_weight_lb: profile.start_weight_lb,
    shot_weekday: profile.shot_weekday,
    steps_goal: profile.steps_goal,
  };
}

export function AccountMenu({ initials, displayName, roleLabel, athlete }: AccountMenuProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-[30px] items-center justify-center rounded-full border border-border-strong bg-raised text-[11px] text-muted-2"
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-[10px] border border-border-strong bg-card p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
        >
          <div className="px-3 py-2">
            <div className="truncate text-[13px] text-ink">{displayName}</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2">
              {roleLabel}
            </div>
          </div>
          {athlete && (
            <div className="border-t border-divider pt-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-[12.5px] text-muted-1 hover:bg-raised"
              >
                Settings
              </button>
            </div>
          )}
          <form action={signOut} className="border-t border-divider pt-1.5">
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-md px-3 py-2 text-left text-[12.5px] text-muted-1 hover:bg-raised"
            >
              Log out
            </button>
          </form>
        </div>
      )}

      {athlete && (
        <EntryFormDialog<ProfileSettings>
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Settings"
          fields={SETTINGS_FIELDS}
          schema={profileSettingsSchema}
          defaultValues={toSettings(athlete)}
          onSubmit={async (values) => {
            await updateProfile(supabase, athlete.id, values);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
