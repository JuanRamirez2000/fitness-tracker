import { TAB_KPIS } from "@/dashboard.config";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { RunningVolumeChart } from "@/components/charts/running-volume-chart";
import { StepsChart } from "@/components/charts/steps-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { RunsTable } from "@/components/dashboard/runs-table";
import { ActivityHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";

/**
 * Training: effort and load, then fitness and speed. HR zones, training load, load focus,
 * fitness age and race predictions join these once their Garmin data is imported.
 */
export function TrainingTab({ data }: { data: DashboardData }) {
  return (
    <>
      <KpiCards data={data} ids={TAB_KPIS.training} />
      <Section>
        <SectionHeading n="01">Am I training at the right effort and load?</SectionHeading>
        <CardGrid>
          <Cell span={5}>
            <StepsChart data={data} />
          </Cell>
          <Cell span={7}>
            <RunningVolumeChart data={data} />
          </Cell>
          <Cell span={12}>
            <ActivityHeatmap data={data} />
          </Cell>
        </CardGrid>
      </Section>
      <Section>
        <SectionHeading n="02">Am I getting fitter and faster?</SectionHeading>
        <CardGrid>
          <Cell span={5}>
            <RunEfficiencyChart data={data} />
          </Cell>
          <Cell span={7}>
            <RunsTable data={data} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
