"use client";

import { useState } from "react";
import { HEATMAP_MODES } from "@/dashboard.config";
import type { DashboardData, HeatmapModeId, ModeContext } from "@/lib/dashboard/types";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { heatmapStats } from "@/lib/heatmap/caption";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { ChipRow } from "@/components/ui/chip-row";
import { Segmented } from "@/components/ui/segmented";
import { HeatmapGrid } from "./heatmap-grid";
import { HeatmapLegend } from "./heatmap-legend";

const RANGE_LABEL: Record<string, string> = {
  week: "this week",
  month: "this month",
  "6m": "the last 6 months",
  year: "the last year",
  all: "all time",
};

const WEIGHT_SUB_MODES = [
  { value: "avg7" as WeightMode, label: "7-day avg" },
  { value: "raw" as WeightMode, label: "Raw" },
];

const HM_TITLES: Record<HeatmapModeId, string> = {
  weight: "Daily weight change",
  calories: "Calorie tracking",
  activity: "Activity",
  steps: "Steps",
  logged: "Logged",
};

const LEGEND_TITLES: Record<HeatmapModeId, string> = {
  weight: "Weight change",
  calories: "Tracking state",
  activity: "Activity type",
  steps: "Daily steps",
  logged: "What got logged",
};

export function HeatmapCard({ data }: { data: DashboardData }) {
  const [modeId, setModeId] = useState<HeatmapModeId>(HEATMAP_MODES[0].id);
  const [weightSubMode, setWeightSubMode] = useState<WeightMode>("avg7");
  // Stretch item (last in the build order): color-blind swap goes here once settings exist.
  const palette = DEFAULT_PALETTE;

  const mode = HEATMAP_MODES.find((m) => m.id === modeId) ?? HEATMAP_MODES[0];
  const ctx: ModeContext = { range: data.dateRange, palette, weightSubMode };
  const stats = heatmapStats(data);
  const rangeLabel = data.dateRange.key === "custom"
    ? `${data.dateRange.from} – ${data.dateRange.to}`
    : RANGE_LABEL[data.dateRange.key];
  const modeOptions = HEATMAP_MODES.map((m) => ({ value: m.id, label: m.label }));

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-border bg-card px-4 pb-4 pt-4 md:gap-[18px] md:px-6 md:pb-5 md:pt-[22px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-serif text-[16px] md:text-[17px]">{HM_TITLES[mode.id]}</span>
          <span className="text-[12px] text-muted-2">
            {`Day ${stats.elapsed} of your journey · ${stats.weighIns} weigh-ins · ${stats.shots} shots`}
          </span>
          <span className="hidden font-mono text-[10.5px] text-muted-2 md:inline">
            {`Showing ${rangeLabel} · days outside the range are dimmed`}
          </span>
        </div>

        {/* Mobile: horizontally-scrollable chip rows. Desktop: the boxed segmented pills,
            right-aligned in their own row. */}
        <div className="flex flex-col gap-2 md:hidden">
          {mode.id === "weight" && (
            <ChipRow aria-label="Weight cell coloring" options={WEIGHT_SUB_MODES} value={weightSubMode} onChange={setWeightSubMode} />
          )}
          <ChipRow aria-label="Heatmap metric" options={modeOptions} value={modeId} onChange={setModeId} />
        </div>
        <div className="hidden items-center justify-end gap-2.5 md:flex">
          {mode.id === "weight" && (
            <Segmented
              aria-label="Weight cell coloring"
              options={WEIGHT_SUB_MODES}
              value={weightSubMode}
              onChange={setWeightSubMode}
            />
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-3">heatmap shows</span>
          <Segmented aria-label="Heatmap metric" options={modeOptions} value={modeId} onChange={setModeId} />
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <HeatmapGrid data={data} mode={mode} ctx={ctx} />
      </div>

      <HeatmapLegend title={LEGEND_TITLES[mode.id]} items={mode.legend(ctx, data)} accent={palette.accent} />
    </div>
  );
}
