"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { DashboardData } from "@/lib/dashboard/types";
import { heatmapStats } from "@/lib/heatmap/caption";
import { RUNNING_MODE } from "@/lib/heatmap/modes/running";
import { STEPS_MODE } from "@/lib/heatmap/modes/steps";
import { WEIGHT_MODE } from "@/lib/heatmap/modes/weight";
import type { WeightMode } from "@/lib/heatmap/weight-rules";
import { HeatmapCard } from "./heatmap-card";

const WEIGHT_SUB_MODES = [
  { value: "avg7" as WeightMode, label: "7-day avg" },
  { value: "raw" as WeightMode, label: "Raw" },
];

const ACTIVITY_MODES = [
  { value: "steps" as const, label: "Steps" },
  { value: "running" as const, label: "Running" },
];

/** The weight and activity (steps or running) heatmaps side by side on wide screens (xl, where each half still
 * leaves ~8px cells), stacked below that. */
export function HeatmapSection({ data }: { data: DashboardData }) {
  const [weightSubMode, setWeightSubMode] = useState<WeightMode>("avg7");
  const [activityMode, setActivityMode] = useState<"steps" | "running">("steps");
  const stats = heatmapStats(data);
  const activityToggle = (
    <Segmented aria-label="Activity heatmap" options={ACTIVITY_MODES} value={activityMode} onChange={setActivityMode} />
  );

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
      {activityMode === "steps" ? (
        <HeatmapCard
          data={data}
          mode={STEPS_MODE}
          title="Daily steps"
          caption={`${stats.stepDaysOverGoal} of ${stats.stepDays} days over 10k`}
          legendTitle="Steps"
          controls={activityToggle}
        />
      ) : (
        <HeatmapCard
          data={data}
          mode={RUNNING_MODE}
          title="Daily running"
          caption={`${stats.runs} run${stats.runs === 1 ? "" : "s"} · ${stats.runMiles.toFixed(1)} mi since day 1`}
          legendTitle="Miles"
          controls={activityToggle}
        />
      )}
    </div>
  );
}
