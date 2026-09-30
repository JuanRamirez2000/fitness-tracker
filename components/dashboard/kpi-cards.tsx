import { KPIS } from "@/dashboard.config";
import type { DashboardData } from "@/lib/dashboard/types";
import { KpiCard } from "./kpi-card";

export function KpiCards({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {KPIS.map((kpi) => {
        const value = kpi.compute(data);
        return (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            visual={kpi.visual}
            emptyMessage={kpi.emptyMessage}
            value={value}
            formatted={value ? kpi.format(value) : null}
          />
        );
      })}
    </div>
  );
}
