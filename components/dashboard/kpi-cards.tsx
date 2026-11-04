import { KPIS } from "@/dashboard.config";
import type { DashboardData } from "@/lib/dashboard/types";
import { KpiCard } from "./kpi-card";

/** The KPI cards with these ids, in dashboard.config.ts order. */
export function KpiCards({ data, ids }: { data: DashboardData; ids: readonly string[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
      {KPIS.filter((kpi) => ids.includes(kpi.id)).map((kpi) => {
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
