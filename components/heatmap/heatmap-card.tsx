"use client";

import type { ReactNode } from "react";
import type { DashboardData, HeatmapMode, ModeContext } from "@/lib/dashboard/types";
import { paletteFor } from "@/lib/theme/palette";
import { cardBgFor } from "@/lib/theme/surfaces";
import { useTheme } from "@/lib/theme/theme-context";
import { HeatmapGrid } from "./heatmap-grid";
import { HeatmapLegend } from "./heatmap-legend";

/** One heatmap: title and caption, optional controls, the year grid, and its legend. */
export function HeatmapCard({
  data,
  mode,
  title,
  caption,
  legendTitle,
  controls,
  ctxOverrides,
  showShots = false,
}: {
  data: DashboardData;
  mode: HeatmapMode;
  title: string;
  caption: string;
  legendTitle: string;
  controls?: ReactNode;
  ctxOverrides?: Partial<ModeContext>;
  showShots?: boolean;
}) {
  const { mode: themeMode } = useTheme();
  const palette = paletteFor(themeMode);
  const ctx: ModeContext = { range: data.dateRange, palette, weightSubMode: "avg7", ...ctxOverrides };

  return (
    <div className="relative flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-serif text-[16px] md:text-[17px]">{title}</span>
          <span className="text-[12px] text-muted-2">{caption}</span>
        </div>
        {controls}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
        <HeatmapGrid data={data} mode={mode} ctx={ctx} cardBg={cardBgFor(themeMode)} showShots={showShots} />
      </div>

      <HeatmapLegend title={legendTitle} items={mode.legend(ctx)} accent={palette.accent} showShots={showShots} />
    </div>
  );
}
