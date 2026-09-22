"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChipRow } from "@/components/ui/chip-row";
import { Segmented } from "@/components/ui/segmented";
import type { DateRange, RangeKey } from "@/lib/dashboard/types";
import type { LocalDate } from "@/lib/dates/calendar";
import { loadStoredRange, storeRange } from "@/lib/range/storage";
import { rangeToSearchParams } from "@/lib/range/url";
import { CustomRangeDialog } from "./custom-range-dialog";

const LABELS: Record<RangeKey, string> = {
  week: "Week",
  month: "Month",
  "6m": "6 months",
  year: "Year",
  all: "All time",
  custom: "Custom",
};
const OPTIONS = (Object.keys(LABELS) as RangeKey[]).map((value) => ({ value, label: LABELS[value] }));

export function RangeControl({
  current,
  wasExplicit,
  today,
}: {
  current: DateRange;
  /** Whether the URL itself named a range, vs. the server falling back to the default —
   * only in the fallback case do we let localStorage override what's on screen. */
  wasExplicit: boolean;
  today: LocalDate;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);

  // "The last-used range is remembered in localStorage and used when the URL has none."
  // Runs once: if this page loaded on the bare URL (server defaulted to "month"), swap in
  // whatever the visitor last picked, without adding an extra history entry.
  useEffect(() => {
    if (wasExplicit) return;
    const stored = loadStoredRange();
    if (stored && stored !== current.key) navigate({ key: stored });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);

  function navigate(range: { key: RangeKey; custom?: { from: string; to: string } }) {
    router.push(`${pathname}?${rangeToSearchParams(range)}`);
  }

  function selectPreset(key: Exclude<RangeKey, "custom">) {
    storeRange(key);
    navigate({ key });
  }

  function handleChange(key: RangeKey) {
    if (key === "custom") setDialogOpen(true);
    else selectPreset(key);
  }

  return (
    <>
      <div className="hidden items-center gap-2.5 md:flex">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-3">range</span>
        <Segmented aria-label="Time range" options={OPTIONS} value={current.key} onChange={handleChange} />
      </div>

      <div className="md:hidden">
        <ChipRow aria-label="Time range" options={OPTIONS} value={current.key} onChange={handleChange} />
      </div>

      <CustomRangeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        today={today}
        initial={current.key === "custom" ? { from: current.from, to: current.to } : null}
        onSelectPreset={(key) => {
          selectPreset(key);
          setDialogOpen(false);
        }}
        onApply={(range) => {
          navigate({ key: "custom", custom: range });
          setDialogOpen(false);
        }}
      />
    </>
  );
}
