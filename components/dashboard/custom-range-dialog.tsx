"use client";

import { useState } from "react";
import { DayPicker, type DateRange as PickerRange } from "react-day-picker";
import { Dialog } from "@/components/ui/dialog";
import type { LocalDate } from "@/lib/dates/calendar";
import { diffDays } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { jsDateToLocalDate, localDateToJsDate } from "@/lib/range/day-picker-adapter";
import type { RangeKey } from "@/lib/dashboard/types";
import "react-day-picker/style.css";
import "./day-picker-theme.css";

const PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "6m", label: "6 months" },
  { key: "year", label: "Year" },
  { key: "all", label: "All time" },
];

export function CustomRangeDialog({
  open,
  onClose,
  today,
  initial,
  onSelectPreset,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  today: LocalDate;
  /** The custom range already applied, if any — seeds the calendar when reopened. */
  initial: { from: LocalDate; to: LocalDate } | null;
  onSelectPreset: (key: Exclude<RangeKey, "custom">) => void;
  onApply: (range: { from: LocalDate; to: LocalDate }) => void;
}) {
  const [draft, setDraft] = useState<PickerRange | undefined>(
    initial ? { from: localDateToJsDate(initial.from), to: localDateToJsDate(initial.to) } : undefined,
  );

  const from = draft?.from ? jsDateToLocalDate(draft.from) : null;
  const to = draft?.to ? jsDateToLocalDate(draft.to) : null;
  const dayCount = from && to ? diffDays(to, from) + 1 : 0;

  return (
    <Dialog open={open} onClose={onClose} labelledBy="custom-range-title" className="w-[672px] max-w-[calc(100vw-40px)]">
      <div className="flex items-center justify-between border-b border-divider px-5 py-[15px]">
        <span id="custom-range-title" className="font-serif text-[17px]">
          Date range
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[14px] text-muted-2">
          {"×"}
        </button>
      </div>

      <div className="flex items-stretch">
        <div className="flex w-[168px] flex-col gap-[3px] border-r border-divider p-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onSelectPreset(preset.key)}
              className="whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-[12.5px] text-muted-1 hover:bg-raised"
            >
              {preset.label}
            </button>
          ))}
          <div className="whitespace-nowrap rounded-lg border border-accent/40 bg-raised px-3.5 py-2.5 text-left text-[12.5px] text-ink">
            Custom
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">Start</span>
              <div className="rounded-[9px] border border-accent bg-inset px-3 py-2.5 text-[13px] shadow-[0_0_0_3px_rgba(127,178,255,0.13)]">
                {from ? fmtDate(from) : "—"}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">End</span>
              <div className="rounded-[9px] border border-field-border bg-inset px-3 py-2.5 text-[13px]">
                {to ? fmtDate(to) : "—"}
              </div>
            </div>
          </div>

          <DayPicker
            className="tracker-day-picker"
            mode="range"
            numberOfMonths={2}
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? localDateToJsDate(today)}
            disabled={{ after: localDateToJsDate(today) }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-divider px-5 py-3.5">
        <span className="font-mono text-[11px] text-muted-2">
          {dayCount > 0 ? `${dayCount} day${dayCount === 1 ? "" : "s"} selected` : "Pick a start and end date"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-field-border px-3.5 py-2 text-[12.5px] text-muted-1"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!from || !to}
            onClick={() => from && to && onApply({ from, to })}
            className="rounded-lg bg-accent px-4 py-2 text-[12.5px] font-medium text-bg disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </Dialog>
  );
}
