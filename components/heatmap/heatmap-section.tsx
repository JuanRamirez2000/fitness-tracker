"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { DashboardData } from "@/lib/dashboard/types";
import { heatmapStats } from "@/lib/heatmap/caption";
import { STEPS_MODE } from "@/lib/heatmap/modes/steps";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { HeatmapCard } from "./heatmap-card";

const WEIGHT_SUB_MODES = [
  { value: "avg7" as WeightMode, label: "7-day avg" },
  { value: "raw" as WeightMode, label: "Raw" },
];

/** The weight and steps heatmaps side by side on wide screens (xl, where each half still
 * leaves ~8px cells), stacked below that. */
export function HeatmapSection({ data }: { data: DashboardData }) {
  const [weightSubMode, setWeightSubMode] = useState<WeightMode>("avg7");
  const stats = heatmapStats(data);

  return (
    <div className="grid gap-3.5 xl:grid-cols-2">
      <HeatmapCard
        data={data}
        mode={WEIGHT_MODE}
        title="Daily weight change"
        caption={`Day ${stats.elapsed} · ${stats.weighIns} weigh-ins · ${stats.shots} shots`}
        legendTitle="Weight"
        controls={
          <Segmented aria-label="Weight cell coloring" options={WEIGHT_SUB_MODES} value={weightSubMode} onChange={setWeightSubMode} />
        }
        ctxOverrides={{ weightSubMode }}
        showShots
      />
      <HeatmapCard
        data={data}
        mode={STEPS_MODE}
        title="Daily steps"
        caption={`${stats.stepDaysOverGoal} of ${stats.stepDays} days over 10k`}
        legendTitle="Steps"
      />
    </div>
  );
}
