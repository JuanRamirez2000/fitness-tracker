import { BestEffortsCard } from "@/components/charts/best-efforts-card";
import { TRAINING_KPIS } from "@/dashboard.config";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { FitnessChart } from "@/components/charts/fitness-chart";
import { LoadFocusCard } from "@/components/charts/load-focus-card";
import { PowerCurveCard } from "@/components/charts/power-curve-card";
import { RaceChart } from "@/components/charts/race-chart";
import { RideEfficiencyChart } from "@/components/charts/ride-efficiency-chart";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { ZonesChart } from "@/components/charts/zones-chart";
import { ActivitiesTable } from "@/components/dashboard/activities-table";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SportToggle } from "@/components/dashboard/sport-toggle";
import { DailySummary } from "@/components/today/daily-summary";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { ActivityHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";
import type { UrlRange } from "@/lib/range/url";

/** Training, under the Ride | Run | All filter: fitness and speed first, then effort and load. */
export function TrainingTab({ data, urlRange }: { data: DashboardData; urlRange: UrlRange | null }) {
  return (
    <>
      <DailySummary data={data} />
      <SportToggle current={data.sport} range={urlRange} />
      <KpiCards data={data} ids={TRAINING_KPIS[data.sport]} />
      <Section>
        <SectionHeading n="01">Am I getting fitter and faster?</SectionHeading>
        <CardGrid>
          {data.sport === "ride" && (
            <>
              <Cell span={12}>
                <PowerCurveCard data={data} />
              </Cell>
              <Cell span={6}>
                <RideEfficiencyChart data={data} />
              </Cell>
              <Cell span={6}>
                <FitnessChart data={data} />
              </Cell>
            </>
          )}
          {data.sport === "run" && (
            <>
              <Cell span={6}>
                <RaceChart data={data} />
              </Cell>
              <Cell span={6}>
                <FitnessChart data={data} />
              </Cell>
              <Cell span={6}>
                <RunEfficiencyChart data={data} />
              </Cell>
              <Cell span={6}>
                <BestEffortsCard data={data} />
              </Cell>
            </>
          )}
          <Cell span={12}>
            <ActivitiesTable data={data} />
          </Cell>
        </CardGrid>
      </Section>
      <Section>
        <SectionHeading n="02">Am I training at the right effort and load?</SectionHeading>
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
    </>
  );
}
