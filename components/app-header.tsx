import { APP_NAME } from "@/lib/app";
import type { Viewer } from "@/lib/auth/viewer";
import { initialsOf } from "@/lib/auth/initials";
import { AccountMenu } from "./account-menu";

function contextLabel(viewer: Viewer | null): string {
  // No viewer only happens while the temporary dev login skip is on (lib/supabase/dev-login.ts).
  if (!viewer) return "Login off · dev";
  if (viewer.profile.role !== "coach") return "Private · 2 people";
  // The coach has the same edit access as the owner, so this names whose data it is
  // without saying "read-only".
  return viewer.athlete ? `Viewing ${viewer.athlete.display_name}'s data` : "No athlete linked";
}

// Desktop (frame 2A): name and context sit together on the left. Mobile (frame 2B): the
// context moves to the right edge, next to the account button.
export function AppHeader({ viewer }: { viewer: Viewer | null }) {
  return (
    <header className="flex items-baseline gap-3 border-b border-divider px-5 py-3 md:gap-[18px] md:px-10 md:py-5">
      <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
      <span className="ml-auto min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-2 md:ml-0 md:text-[11px] md:tracking-[0.1em]">
        {contextLabel(viewer)}
      </span>
      {viewer && (
        <div className="flex items-center gap-2.5 self-center md:ml-auto">
          <AccountMenu
            initials={initialsOf(viewer.profile.display_name)}
            displayName={viewer.profile.display_name}
            roleLabel={viewer.profile.role}
          />
        </div>
      )}
    </header>
  );
}
