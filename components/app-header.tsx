import { APP_NAME } from "@/lib/app";
import type { Viewer } from "@/lib/auth/viewer";
import { initialsOf } from "@/lib/auth/initials";
import { AccountMenu } from "./account-menu";

function contextLabel(viewer: Viewer): string {
  if (!viewer.readOnly) return "Private · 2 people";
  return viewer.athlete
    ? `Viewing ${viewer.athlete.display_name}'s data · read-only`
    : "No athlete linked";
}

// Desktop (frame 2A): name and context sit together on the left. Mobile (frame 2B): the
// context moves to the right edge, next to the account button.
export function AppHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className="flex items-baseline gap-3 border-b border-divider px-5 py-3 md:gap-[18px] md:px-10 md:py-5">
      <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
      <span className="ml-auto min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-2 md:ml-0 md:text-[11px] md:tracking-[0.1em]">
        {contextLabel(viewer)}
      </span>
      <div className="flex items-center gap-2.5 self-center md:ml-auto">
        <AccountMenu
          initials={initialsOf(viewer.profile.display_name)}
          displayName={viewer.profile.display_name}
          roleLabel={viewer.profile.role}
        />
      </div>
    </header>
  );
}
