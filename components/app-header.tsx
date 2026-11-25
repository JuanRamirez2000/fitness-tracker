import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";
import { signOut } from "@/lib/auth/actions";
import type { DashboardShell } from "@/lib/dashboard/types";
import type { UrlRange } from "@/lib/range/url";
import { GarminRefreshButton } from "./dashboard/garmin-refresh-button";
import { WeekPicker } from "./dashboard/week-picker";
import { SettingsDialog } from "./dashboard/settings-dialog";
import { TabRow } from "./dashboard/tab-row";
import { ThemeToggle } from "./theme-toggle";
import { mondayOf } from "@/lib/dates/calendar";
import { PhoneHeaderMenu } from "./dashboard/header-menu";

/**
 * The sticky header: brand, the week picker every tab shares and the owner actions, then the
 * tab row. Below lg it's two rows (docs/plan-home-and-header.md): the name, a compact week
 * picker, Log feel and a ⋯ menu holding Refresh, Settings, the theme and Lock; then the tabs.
 */
export function AppHeader({
  data,
  canEdit,
  urlRange,
  moodButton,
}: {
  /** The page's first query: renders before the tab's rows are in. */
  data: DashboardShell;
  canEdit: boolean;
  /** The URL's own range, or null when the page fell back to the default. */
  urlRange: UrlRange | null;
  /** The owner's Log feel button (components/mood/), streamed in its own Suspense. */
  moodButton?: ReactNode;
}) {
  const weekPicker = { week: data.week, today: data.today, programStart: data.programStart, range: urlRange, tab: data.tab };
  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-bg">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-x-3 px-4 pt-2.5 pb-1 md:px-8 lg:pt-4 lg:pb-2 xl:max-w-[1460px]">
        <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2 lg:inline">{data.profile.display_name}</span>

        {/* One week for every tab: compact in the middle of the phone row, full beside the actions from lg. */}
        <div className="flex min-w-0 flex-1 justify-center lg:hidden">
          <WeekPicker {...weekPicker} compact />
        </div>
        <div className="hidden lg:ml-auto lg:block">
          <WeekPicker {...weekPicker} />
        </div>

        <div className="flex items-center gap-2.5 lg:ml-3">
          {moodButton}
          <div className="hidden items-center gap-2.5 lg:flex">
            {canEdit && <GarminRefreshButton tab={data.tab} />}
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
          <div className="lg:hidden">
            <PhoneHeaderMenu tab={data.tab} profile={data.profile} canEdit={canEdit} />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-8 xl:max-w-[1460px]">
        <TabRow current={data.tab} range={urlRange} week={data.week < mondayOf(data.today) ? data.week : null} />
      </div>
    </header>
  );
}
