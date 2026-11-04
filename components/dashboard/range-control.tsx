"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChipRow } from "@/components/ui/chip-row";
import { Segmented } from "@/components/ui/segmented";
import type { DateRange, RangeKey, TabKey } from "@/lib/dashboard/types";
import type { LocalDate } from "@/lib/dates/calendar";
import { storeRange } from "@/lib/range/storage";
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

/** The range picker. Restoring the last-used range on a bare URL is StoredViewRestorer's job. */
export function RangeControl({ current, tab, today }: { current: DateRange; tab: TabKey; today: LocalDate }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);

  function navigate(range: { key: RangeKey; custom?: { from: string; to: string } }) {
    router.push(`${pathname}?${rangeToSearchParams(range, tab)}`);
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
