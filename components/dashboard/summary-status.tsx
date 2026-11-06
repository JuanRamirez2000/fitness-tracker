"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { SummarySkeleton } from "./skeletons";

/**
 * Whether today's AI summaries are being rewritten right now (step two of the Refresh button,
 * components/dashboard/garmin-refresh-button.tsx), so the summary in the tab body can show a
 * skeleton meanwhile. The button sits in the header and the summary in the tab, hence the
 * context around both (app/page.tsx).
 */
const SummaryStatus = createContext<{ writing: boolean; setWriting: (writing: boolean) => void }>({
  writing: false,
  setWriting: () => {},
});

export function SummaryStatusProvider({ children }: { children: ReactNode }) {
  const [writing, setWriting] = useState(false);
  return <SummaryStatus value={{ writing, setWriting }}>{children}</SummaryStatus>;
}

export function useSummaryStatus() {
  return use(SummaryStatus);
}

/** The summary itself, or a skeleton with "Writing…" while it's being rewritten. */
export function SummaryWriting({ label, children }: { label: string; children: ReactNode }) {
  const { writing } = useSummaryStatus();
  return writing ? <SummarySkeleton label={`${label} · writing…`} /> : children;
}
