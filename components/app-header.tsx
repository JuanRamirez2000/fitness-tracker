import Link from "next/link";
import { APP_NAME } from "@/lib/app";
import { signOut } from "@/lib/auth/actions";
import type { DashboardData } from "@/lib/dashboard/types";
import { GarminRefreshButton } from "./dashboard/garmin-refresh-button";
import { RangeControl } from "./dashboard/range-control";
import { SettingsDialog } from "./dashboard/settings-dialog";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ data, canEdit, rangeExplicit }: { data: DashboardData; canEdit: boolean; rangeExplicit: boolean }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-divider px-4 py-3 md:px-8 md:py-4">
      <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">
        {data.profile.display_name}
      </span>

      <div className="ml-auto flex items-center gap-2.5">
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

      <div className="w-full">
        <RangeControl current={data.dateRange} wasExplicit={rangeExplicit} today={data.today} />
      </div>
    </header>
  );
}
