import { KPIS } from "@/dashboard.config";
import type { DashboardData } from "@/lib/dashboard/types";
import { KpiCard } from "./kpi-card";

/**
 * The KPI cards with these ids, in the order given: a row of six units on a desktop
 * (three on a tablet, two on a phone), where a wide card takes two. Dense packing backfills the
 * gap a wide card would leave at the end of a narrower row.
 */
export function KpiCards({ data, ids }: { data: DashboardData; ids: readonly string[] }) {
  return (
    <div className="grid grid-flow-dense grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {ids.flatMap((id) => KPIS.find((k) => k.id === id) ?? []).map((kpi) => {
        const value = kpi.compute(data);
        return (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            span={kpi.span}
            bandLabel={kpi.bandLabel}
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
