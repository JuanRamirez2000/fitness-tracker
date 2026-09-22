import { APP_NAME } from "@/lib/app";
import type { Viewer } from "@/lib/auth/viewer";
import { initialsOf } from "@/lib/auth/initials";
import type { DateRange } from "@/lib/dashboard/types";
import type { LocalDate } from "@/lib/dates/calendar";
import { AccountMenu } from "./account-menu";
import { RangeControl } from "./dashboard/range-control";
import { QuickLogLauncher, type QuickLogLauncherProps } from "./dashboard/quick-log-launcher";

function contextLabel(viewer: Viewer | null): string {
  // No viewer only happens while the temporary dev login skip is on (lib/supabase/dev-login.ts).
  if (!viewer) return "Login off · dev";
  if (viewer.profile.role !== "coach") return "Private · 2 people";
  // The coach has the same edit access as the owner, so this names whose data it is
  // without saying "read-only".
  return viewer.athlete ? `Viewing ${viewer.athlete.display_name}'s data` : "No athlete linked";
}

interface AppHeaderProps {
  viewer: Viewer | null;
  /** The resolved range and today's local date, or null when there is no dashboard to show
   * (signed out during the dev login skip, or a coach with no athlete linked yet). */
  range: DateRange | null;
  rangeExplicit: boolean;
  today: LocalDate | null;
  /** Same null-when-no-dashboard condition as `range`. */
  quickLog: QuickLogLauncherProps | null;
}

// Desktop (frame 2A): title, context, the range control, "+ Log today" and the account menu
// share one row, in that order (md:order-*, since ml-auto's push has to start from the
// first of the three that come later in the DOM than the account menu).
// Mobile (frame 2B): the range control's own mobile variant (a horizontal chip row, not the
// segmented pill) wraps to a full-width line below title/context/account; the log trigger
// becomes the floating "+" button instead (QuickLogLauncher renders both, CSS-toggled).
export function AppHeader({ viewer, range, rangeExplicit, today, quickLog }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-divider px-5 py-3 md:flex-nowrap md:items-baseline md:gap-[18px] md:px-10 md:py-5">
      <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
      <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-2 md:text-[11px] md:tracking-[0.1em]">
        {contextLabel(viewer)}
      </span>

      {viewer && (
        <div className="ml-auto flex items-center gap-2.5 self-center md:order-4 md:ml-0">
          <AccountMenu
            initials={initialsOf(viewer.profile.display_name)}
            displayName={viewer.profile.display_name}
            roleLabel={viewer.profile.role}
          />
        </div>
      )}

      {range && today && (
        <div className="order-last w-full md:order-2 md:ml-auto md:w-auto">
          <RangeControl current={range} wasExplicit={rangeExplicit} today={today} />
        </div>
      )}

      {quickLog && (
        <div className="md:order-3">
          <QuickLogLauncher {...quickLog} />
        </div>
      )}
    </header>
  );
}
