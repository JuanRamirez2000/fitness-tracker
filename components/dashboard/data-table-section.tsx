"use client";

import { useMemo, useState } from "react";
import { TABLE_TAB_IDS, TABLE_TAB_LABELS, type TableTabId } from "@/dashboard.config";
import type { DashboardData, RangeKey } from "@/lib/dashboard/types";
import { makeActivityTab } from "@/lib/dashboard/table-tabs/activity";
import { makeCaloriesTab } from "@/lib/dashboard/table-tabs/calories";
import { makeShotsTab } from "@/lib/dashboard/table-tabs/shots";
import { makeStepsTab } from "@/lib/dashboard/table-tabs/steps";
import { makeWeighInsTab } from "@/lib/dashboard/table-tabs/weigh-ins";
import { resolveRange } from "@/lib/range/resolve";
import { Segmented } from "@/components/ui/segmented";
import { DataTable } from "./data-table";

// The table's own range override skips "custom" to keep the control simple — the page-level
// custom picker (RangeControl) still reaches the table too, since it changes dateRange itself.
const OVERRIDE_KEYS: Exclude<RangeKey, "custom">[] = ["week", "month", "6m", "year", "all"];
const OVERRIDE_OPTIONS = OVERRIDE_KEYS.map((value) => ({
  value,
  label: { week: "Week", month: "Month", "6m": "6 months", year: "Year", all: "All time" }[value],
}));

export function DataTableSection({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<TableTabId>(TABLE_TAB_IDS[0]);
  // "The table's date filter defaults to the range and can be overridden" — starts at the
  // page's own range, but changing it here does not touch the URL or the heatmap/charts.
  const [overrideKey, setOverrideKey] = useState<RangeKey>(data.dateRange.key === "custom" ? "month" : data.dateRange.key);

  const range = useMemo(
    () => (overrideKey === data.dateRange.key ? data.dateRange : resolveRange(overrideKey, data.today, data.programStart)),
    [overrideKey, data.dateRange, data.today, data.programStart],
  );

  const ctx = { activityTypes: data.activityTypes, timezone: data.profile.timezone };
  const userId = data.profile.id;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Entries</span>
        <Segmented aria-label="Table date range" options={OVERRIDE_OPTIONS} value={overrideKey} onChange={setOverrideKey} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-divider">
        {TABLE_TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`shrink-0 whitespace-nowrap px-[13px] py-2.5 text-[12.5px] ${
              id === activeTab ? "border-b-2 border-accent text-ink" : "border-b-2 border-transparent text-muted-2"
            }`}
          >
            {TABLE_TAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {activeTab === "weigh-ins" && <DataTable tab={makeWeighInsTab(ctx)} userId={userId} today={data.today} range={range} />}
        {activeTab === "calories" && <DataTable tab={makeCaloriesTab(ctx)} userId={userId} today={data.today} range={range} />}
        {activeTab === "activity" && <DataTable tab={makeActivityTab(ctx)} userId={userId} today={data.today} range={range} />}
        {activeTab === "steps" && <DataTable tab={makeStepsTab(ctx)} userId={userId} today={data.today} range={range} />}
        {activeTab === "shots" && <DataTable tab={makeShotsTab(ctx)} userId={userId} today={data.today} range={range} />}
      </div>
    </div>
  );
}
