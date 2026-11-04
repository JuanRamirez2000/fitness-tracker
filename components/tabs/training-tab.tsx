import { TAB_KPIS } from "@/dashboard.config";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { FitnessChart } from "@/components/charts/fitness-chart";
import { LoadFocusCard } from "@/components/charts/load-focus-card";
import { RaceCard } from "@/components/charts/race-card";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { ZonesChart } from "@/components/charts/zones-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { RunsTable } from "@/components/dashboard/runs-table";
import { ActivityHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";

/** Training: effort and load, then fitness and speed. */
export function TrainingTab({ data }: { data: DashboardData }) {
  return (
    <>
      <KpiCards data={data} ids={TAB_KPIS.training} />
      <Section>
        <SectionHeading n="01">Am I training at the right effort and load?</SectionHeading>
        <CardGrid>
          <Cell span={6}>
            <ZonesChart data={data} />
          </Cell>
          <Cell span={6}>
            <TrainingLoadChart data={data} />
          </Cell>
          <Cell span={12}>
            <LoadFocusCard data={data} />
          </Cell>
          <Cell span={12}>
            <ActivityHeatmap data={data} />
          </Cell>
        </CardGrid>
      </Section>
      <Section>
        <SectionHeading n="02">Am I getting fitter and faster?</SectionHeading>
        <CardGrid>
          <Cell span={6}>
            <RunEfficiencyChart data={data} />
          </Cell>
          <Cell span={6}>
            <FitnessChart data={data} />
          </Cell>
          <Cell span={5}>
            <RaceCard data={data} />
          </Cell>
          <Cell span={7}>
            <RunsTable data={data} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
