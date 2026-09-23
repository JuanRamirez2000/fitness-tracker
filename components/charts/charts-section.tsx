import type { DashboardData } from "@/lib/dashboard/types";
import { ActivityChart } from "./activity-chart";
import { CaloriesChart } from "./calories-chart";
import { OpenChartSlot } from "./open-chart-slot";
import { ProgressChart } from "./progress-chart";
import { StepsChart } from "./steps-chart";
import { WeeklyRateChart } from "./weekly-rate-chart";
import { WeightTrendChart } from "./weight-trend-chart";

/**
 * Step 8: the "Charts" section (frame 2A), independent of the heatmap's own metric selector.
 * Desktop gets the full weight trend chart plus a 2/3-column grid of five more cards and the
 * design's own "open chart slot" placeholder. Mobile (frame 2B) only has room for the trend
 * chart in its compact form — the other five cards are desktop-only, the same tradeoff
 * KpiGrid and HeatmapCard already make for their own mobile layouts.
 */
export function ChartsSection({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">Charts</span>
        <span className="hidden font-mono text-[10px] text-muted-3 md:inline">independent of the heatmap selector</span>
      </div>

      <div className="md:hidden">
        <WeightTrendChart data={data} compact />
      </div>

      <div className="hidden flex-col gap-3.5 md:flex">
        <WeightTrendChart data={data} />
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
          <ProgressChart data={data} />
          <WeeklyRateChart data={data} />
          <StepsChart data={data} />
          <CaloriesChart data={data} />
          <ActivityChart data={data} />
          <OpenChartSlot />
        </div>
      </div>
    </div>
  );
}
