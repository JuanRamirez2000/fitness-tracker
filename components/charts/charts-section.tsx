import type { DashboardData } from "@/lib/dashboard/types";
import { ProgressChart } from "./progress-chart";
import { StepsChart } from "./steps-chart";
import { WeeklyRateChart } from "./weekly-rate-chart";
import { WeightTrendChart } from "./weight-trend-chart";

export function ChartsSection({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-3.5">
      <WeightTrendChart data={data} />
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        <ProgressChart data={data} />
        <WeeklyRateChart data={data} />
        <StepsChart data={data} />
      </div>
    </div>
  );
}
