import type { ReactNode } from "react";
import { BestEffortsCard } from "@/components/charts/best-efforts-card";
import { FitnessChart } from "@/components/charts/fitness-chart";
import { PowerCurveCard } from "@/components/charts/power-curve-card";
import { PowerZonesCard } from "@/components/charts/power-zones-card";
import { RaceChart } from "@/components/charts/race-chart";
import { RideEfficiencyChart } from "@/components/charts/ride-efficiency-chart";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { SportSwitch } from "@/components/dashboard/sport-switch";
import { IntensityCard } from "@/components/progress/intensity-card";
import { WeekPlanner } from "@/components/workouts/week-planner";
import { SportBadge } from "@/components/ui/sport-badge";
import { TRAINING_KPIS } from "@/dashboard.config";
import { sportsInRange } from "@/lib/charts/all-sports";
import type { DashboardData } from "@/lib/dashboard/types";
import { intensitySplit } from "@/lib/progress/build";
import { progressWeek } from "@/lib/progress/week";
import type { ActiveSport, SportFilter } from "@/lib/sport";
import { doneToday } from "@/lib/workouts/done";

/**
 * Training: am I getting fitter? (docs/plan-four-tabs.md) The next 7 days to plan in, the key
 * numbers beside easy vs hard, how much, then a section of charts per sport, driven by the range
 * control. Easy vs hard follows the picked week.
 */
export function TrainingTab({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const week = progressWeek(data.week, data.today);
  const sports = sportsInRange(data);
  const share = (render: (d: DashboardData) => ReactNode) => <Shared data={data} sports={sports} render={render} />;

  return (
    <>
      {data.planner && (
        <section id="next-7-days" aria-label="Next 7 days" className="scroll-mt-28">
          <WeekPlanner planner={data.planner} canEdit={canEdit} done={doneToday(data)} />
        </section>
      )}

      <Section id="training-metrics">
        <SectionHeadingRow n="01" control={<RangeControl current={data.dateRange} tab="training" sport="all" today={data.today} />}>
          How is training going?
        </SectionHeadingRow>
        <CardGrid>
          <Cell span={7}>
            <KpiCards data={data} ids={TRAINING_KPIS} columns={3} />
          </Cell>
          <Cell span={5}>
            <IntensityCard split={intensitySplit(data, week)} />
          </Cell>
        </CardGrid>
      </Section>

      <Section id="load">
        <SectionHeading n="02">How much am I training?</SectionHeading>
        <CardGrid>
          <Cell span={12}>{share((d) => <TrainingLoadChart data={d} />)}</Cell>
          <Cell span={12}>
            <WeeklyVolumeChart data={data} />
          </Cell>
        </CardGrid>
      </Section>

      <Section id="running">
        <SectionHeading n="03">
          <SportHeading sport="run">Running: am I getting faster?</SportHeading>
        </SectionHeading>
        <CardGrid>
          <Cell span={6}>
            <RaceChart data={data} />
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
        </CardGrid>
      </Section>

      <Section id="riding">
        <SectionHeading n="04">
          <SportHeading sport="ride">Cycling: is my power going up?</SportHeading>
        </SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <PowerCurveCard data={data} />
          </Cell>
          <Cell span={6}>
            <RideEfficiencyChart data={data} />
          </Cell>
          <Cell span={6}>
            <PowerZonesCard data={data} />
          </Cell>
        </CardGrid>
      </Section>

      <Section id="swimming">
        <SectionHeading n="05">
          <SportHeading sport="swim">Swimming</SportHeading>
        </SectionHeading>
        {/* The swim charts (pace per 100 yd, SWOLF, stroke rate) wait for real swims (January 2027). */}
        <div className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-[12.5px] text-muted-2 md:px-6">
          Swim charts (pace per 100 yards, SWOLF, stroke rate) come once a few swims have synced. Until then your swims count in the load and volume charts above.
        </div>
      </Section>
    </>
  );
}

function SportHeading({ sport, children }: { sport: ActiveSport; children: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {children}
      <SportBadge sport={sport} className="align-middle" />
    </span>
  );
}

/**
 * A shared card: with two or more sports in the range, rendered once per option (All, then
 * each sport) inside a SportSwitch; otherwise once.
 */
function Shared({ data, sports, render }: { data: DashboardData; sports: ActiveSport[]; render: (d: DashboardData) => ReactNode }) {
  if (sports.length < 2) return <>{render(data)}</>;
  const panels: Partial<Record<SportFilter, ReactNode>> = { all: render(data) };
  for (const sport of sports) panels[sport] = render({ ...data, sport });
  return <SportSwitch panels={panels} />;
}
