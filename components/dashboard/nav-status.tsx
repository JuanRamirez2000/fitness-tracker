"use client";

import { useLinkStatus } from "next/link";
import {
  createContext,
  use,
  useEffect,
  useState,
  useTransition,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { RangeKey, TabKey } from "@/lib/dashboard/types";
import { TabSkeleton } from "./skeletons";

/**
 * Feedback the moment a tab or range is clicked. A tab or range lives in the URL's search
 * params, and Next keeps the page mounted across those (no loading.js fallback): without this
 * the old tab would stay on screen, unchanged, until the new one had fully loaded.
 *
 * - A tab click underlines the new tab and shows that tab's skeleton right away (TabRow,
 *   TabBodyFrame). Pending state comes from the tab's own Link (useLinkStatus), which Next
 *   resets when the navigation completes or is superseded.
 * - A range click lights the new range and dims the current tab until its new rows arrive
 *   (RangeControl's router.push runs in `startRange`).
 */
const NavStatus = createContext<{
  pendingTab: TabKey | null;
  setPendingTab: Dispatch<SetStateAction<TabKey | null>>;
  pendingRange: RangeKey | null;
  rangePending: boolean;
  startRange: (key: RangeKey, navigate: () => void) => void;
}>({
  pendingTab: null,
  setPendingTab: () => {},
  pendingRange: null,
  rangePending: false,
  startRange: (_key, navigate) => navigate(),
});

export function NavStatusProvider({ children }: { children: ReactNode }) {
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [pendingRange, setPendingRange] = useState<RangeKey | null>(null);
  const [rangePending, startTransition] = useTransition();
  function startRange(key: RangeKey, navigate: () => void) {
    setPendingRange(key);
    startTransition(navigate);
  }
  return (
    <NavStatus value={{ pendingTab, setPendingTab, pendingRange: rangePending ? pendingRange : null, rangePending, startRange }}>
      {children}
    </NavStatus>
  );
}

export function useNavStatus() {
  return use(NavStatus);
}

/** Rendered inside each tab's Link: reports that Link's pending navigation. Renders nothing. */
export function PendingTabReporter({ tab }: { tab: TabKey }) {
  const { pending } = useLinkStatus();
  const { setPendingTab } = useNavStatus();
  useEffect(() => {
    if (!pending) return;
    setPendingTab(tab);
    return () => setPendingTab((current) => (current === tab ? null : current));
  }, [pending, tab, setPendingTab]);
  return null;
}

/** The tab body: its skeleton while another tab is loading, dimmed while a new range loads. */
export function TabBodyFrame({ current, children }: { current: TabKey; children: ReactNode }) {
  const { pendingTab, rangePending } = useNavStatus();
  if (pendingTab && pendingTab !== current) return <TabSkeleton tab={pendingTab} />;
  return (
    <div
      className={`flex flex-col gap-12 transition-opacity duration-150 ${rangePending ? "pointer-events-none opacity-50" : ""}`}
      aria-busy={rangePending || undefined}
    >
      {children}
    </div>
  );
}
