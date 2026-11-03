import type { DashboardData } from "@/lib/dashboard/types";
import { FastestMileChart } from "./fastest-mile-chart";
import { ProgressChart } from "./progress-chart";
import { RunEfficiencyChart } from "./run-efficiency-chart";
import { RunningVolumeChart } from "./running-volume-chart";
import { StepsChart } from "./steps-chart";
import { TrendWindowsRow } from "./trend-windows-row";
import { WeeklyRateChart } from "./weekly-rate-chart";
import { WeightTrendChart } from "./weight-trend-chart";

export function ChartsSection({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-3.5">
      <WeightTrendChart data={data} />
      <TrendWindowsRow data={data} />
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        <ProgressChart data={data} />
        <WeeklyRateChart data={data} />
        <StepsChart data={data} />
        <RunningVolumeChart data={data} />
        <RunEfficiencyChart data={data} />
        <FastestMileChart data={data} />
      </div>
    </div>
  );
}
