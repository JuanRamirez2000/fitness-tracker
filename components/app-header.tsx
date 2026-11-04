import Link from "next/link";
import { APP_NAME } from "@/lib/app";
import { signOut } from "@/lib/auth/actions";
import type { DashboardData } from "@/lib/dashboard/types";
import type { UrlRange } from "@/lib/range/url";
import { GarminRefreshButton } from "./dashboard/garmin-refresh-button";
import { RangeControl } from "./dashboard/range-control";
import { SettingsDialog } from "./dashboard/settings-dialog";
import { TabRow } from "./dashboard/tab-row";
import { ThemeToggle } from "./theme-toggle";

/**
 * The sticky header: brand and owner actions, the range control (beside the brand at lg,
 * on its own row below that), and the tab row.
 */
export function AppHeader({
  data,
  canEdit,
  urlRange,
}: {
  data: DashboardData;
  canEdit: boolean;
  /** The URL's own range, or null when the page fell back to the default. */
  urlRange: UrlRange | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-bg">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-2.5 px-4 pt-3 pb-2 md:px-8 md:pt-4">
        <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">
          {data.profile.display_name}
        </span>

        <div className="order-last w-full min-w-0 lg:order-none lg:ml-auto lg:w-auto">
          <RangeControl current={data.dateRange} tab={data.tab} today={data.today} />
        </div>

        <div className="ml-auto flex items-center gap-2.5 lg:ml-3">
          {canEdit && <GarminRefreshButton />}
          {canEdit && <SettingsDialog profile={data.profile} />}
          <ThemeToggle />
          {canEdit ? (
            <form action={signOut}>
              <button type="submit" className="text-[12px] text-muted-2 hover:text-ink">
                Lock
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-[12px] text-muted-2 hover:text-ink">
              Edit
            </Link>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-8">
        <TabRow current={data.tab} range={urlRange} />
      </div>
    </header>
  );
}
