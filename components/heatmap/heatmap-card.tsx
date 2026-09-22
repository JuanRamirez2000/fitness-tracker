"use client";

import { useState } from "react";
import { HEATMAP_MODES } from "@/dashboard.config";
import type { DashboardData, HeatmapModeId, ModeContext } from "@/lib/dashboard/types";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { heatmapStats } from "@/lib/heatmap/caption";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
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

  return (
    <div className="relative flex flex-col gap-[18px] rounded-xl border border-border bg-card px-6 pb-5 pt-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex flex-col gap-1">
          <span className="font-serif text-[17px]">{HM_TITLES[mode.id]}</span>
          <span className="text-[12px] text-muted-2">
            {`Day ${stats.elapsed} of your journey · ${stats.weighIns} weigh-ins · ${stats.shots} shots`}
          </span>
          <span className="font-mono text-[10.5px] text-muted-2">
            {`Showing ${rangeLabel} · days outside the range are dimmed`}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {mode.id === "weight" && (
            <Segmented
              aria-label="Weight cell coloring"
              options={WEIGHT_SUB_MODES}
              value={weightSubMode}
              onChange={setWeightSubMode}
            />
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-3">heatmap shows</span>
          <Segmented
            aria-label="Heatmap metric"
            options={HEATMAP_MODES.map((m) => ({ value: m.id, label: m.label }))}
            value={modeId}
            onChange={setModeId}
          />
        </div>
      </div>

      <HeatmapGrid data={data} mode={mode} ctx={ctx} />

      <HeatmapLegend title={`${mode.label} change`} items={mode.legend(ctx)} accent={palette.accent} />
    </div>
  );
}
