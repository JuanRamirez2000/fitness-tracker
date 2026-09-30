"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { DashboardData, ModeContext } from "@/lib/dashboard/types";
import { heatmapStats } from "@/lib/heatmap/caption";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { paletteFor } from "@/lib/theme/palette";
import { useTheme } from "@/lib/theme/theme-context";
import { HeatmapGrid } from "./heatmap-grid";
import { HeatmapLegend } from "./heatmap-legend";

const WEIGHT_SUB_MODES = [
  { value: "avg7" as WeightMode, label: "7-day avg" },
  { value: "raw" as WeightMode, label: "Raw" },
];

export function HeatmapCard({ data }: { data: DashboardData }) {
  const [weightSubMode, setWeightSubMode] = useState<WeightMode>("avg7");
  const { mode: themeMode } = useTheme();
  const palette = paletteFor(themeMode);
  const ctx: ModeContext = { range: data.dateRange, palette, weightSubMode };
  const stats = heatmapStats(data);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-4 md:px-6 md:py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-serif text-[16px] md:text-[17px]">Daily weight change</span>
          <span className="text-[12px] text-muted-2">{`Day ${stats.elapsed} · ${stats.weighIns} weigh-ins this year`}</span>
        </div>
        <Segmented aria-label="Weight cell coloring" options={WEIGHT_SUB_MODES} value={weightSubMode} onChange={setWeightSubMode} />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <HeatmapGrid data={data} mode={WEIGHT_MODE} ctx={ctx} />
      </div>

      <HeatmapLegend title="Weight change" items={WEIGHT_MODE.legend(ctx)} />
    </div>
  );
}
