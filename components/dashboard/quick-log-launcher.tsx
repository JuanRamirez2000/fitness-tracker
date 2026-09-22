"use client";

import { useState } from "react";
import type { ActivityType } from "@/lib/data/activity-types";
import type { LocalDate } from "@/lib/dates/calendar";
import { QuickLogSheet } from "./quick-log-sheet";

export interface QuickLogLauncherProps {
  userId: string;
  timezone: string;
  today: LocalDate;
  activityTypes: ActivityType[];
  stepsGoal: number;
}

/** Desktop's "+ Log today" pill (frame 2A, in the header) and mobile's floating "+" button
 * (frame 2B) are two triggers for the same sheet — both shown to the coach too, since they
 * have the same write access as the owner (see lib/auth/viewer.ts). */
export function QuickLogLauncher(props: QuickLogLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded-lg bg-accent px-3.5 py-[7px] text-[12.5px] font-medium text-bg md:inline-flex md:items-center"
      >
        + Log today
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log today"
        className="fixed right-[18px] bottom-24 z-40 flex size-[52px] items-center justify-center rounded-full bg-accent text-[26px] text-bg shadow-[0_8px_24px_rgba(0,0,0,0.5)] md:hidden"
      >
        +
      </button>
      {open && <QuickLogSheet onClose={() => setOpen(false)} {...props} />}
    </>
  );
}
