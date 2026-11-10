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
import { SportBadge } from "@/components/ui/sport-badge";
import { DailySummary } from "@/components/today/daily-summary";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { ActivityHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";
import { runsIn } from "@/lib/running/runs";
import { isRide, isRun, SPORT_NOUN } from "@/lib/sport";
import type { UrlRange } from "@/lib/range/url";

/** Training, under the All | Ride | Run filter: fitness and speed first, then effort and load. */
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
          {data.sport === "all" && <AllSportsCharts data={data} />}
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

/**
 * Every ride and run chart at once, rides beside runs in pairs. A sport with nothing in the
 * range folds into one line, and the other sport's charts take the row.
 */
function AllSportsCharts({ data }: { data: DashboardData }) {
  const rides = runsIn(data.activities.filter(isRide), data.dateRange).length > 0;
  const runs = runsIn(data.activities.filter(isRun), data.dateRange).length > 0;

  if (rides && runs) {
    return (
      <>
        <Cell span={6}>
          <PowerCurveCard data={data} />
        </Cell>
        <Cell span={6}>
          <RaceChart data={data} />
        </Cell>
        <Cell span={6}>
          <RideEfficiencyChart data={data} />
        </Cell>
        <Cell span={6}>
          <RunEfficiencyChart data={data} />
        </Cell>
        <Cell span={6}>
          <FitnessChart data={data} />
        </Cell>
        <Cell span={6}>
          <BestEffortsCard data={data} />
        </Cell>
      </>
    );
  }
  if (rides) {
    return (
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
        <Cell span={12}>
          <QuietSport sport="run" />
        </Cell>
      </>
    );
  }
  if (runs) {
    return (
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
        <Cell span={12}>
          <QuietSport sport="ride" />
        </Cell>
      </>
    );
  }
  return (
    <Cell span={12}>
      <FitnessChart data={data} />
    </Cell>
  );
}

/** One line in place of a sport's charts when the range has none of it. */
function QuietSport({ sport }: { sport: "ride" | "run" }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-border-strong px-4 py-3 md:px-6">
      <SportBadge sport={sport} />
      <span className="text-[12.5px] text-muted-2">
        No {SPORT_NOUN[sport].many} in this range, so the {sport === "ride" ? "riding" : "running"} charts are folded away.
      </span>
    </div>
  );
}
