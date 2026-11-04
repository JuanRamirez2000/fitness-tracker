import { TAB_KPIS } from "@/dashboard.config";
import { BodyMassChart } from "@/components/charts/body-mass-chart";
import { CompositionCard } from "@/components/charts/composition-card";
import { WeightTrendChart } from "@/components/charts/weight-trend-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { WeighInTable } from "@/components/dashboard/weigh-in-table";
import { WeightHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";

/** Weight: "Am I losing fat, not muscle?" */
export function WeightTab({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  return (
    <>
      <KpiCards data={data} ids={TAB_KPIS.weight} />
      <Section>
        <SectionHeading n="01">Am I losing fat, not muscle?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <WeightTrendChart data={data} />
          </Cell>
          <Cell span={7}>
            <BodyMassChart data={data} />
          </Cell>
          <Cell span={5}>
            <CompositionCard data={data} />
          </Cell>
          <Cell span={12}>
            <WeightHeatmap data={data} />
          </Cell>
          <Cell span={12}>
            <WeighInTable data={data} canEdit={canEdit} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
