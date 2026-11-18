import type { ReactNode } from "react";
import { BestEffortsCard } from "@/components/charts/best-efforts-card";
import { BrickCard } from "@/components/charts/brick-card";
import { FitnessChart } from "@/components/charts/fitness-chart";
import { PowerCurveCard } from "@/components/charts/power-curve-card";
import { PowerZonesCard } from "@/components/charts/power-zones-card";
import { RaceChart } from "@/components/charts/race-chart";
import { RideEfficiencyChart } from "@/components/charts/ride-efficiency-chart";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { SessionMixCard } from "@/components/charts/session-mix-card";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { ZonesChart } from "@/components/charts/zones-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { SportSwitch } from "@/components/dashboard/sport-switch";
import { WeekSoFar } from "@/components/dashboard/week-so-far";
import { IntensityCard } from "@/components/progress/intensity-card";
import { FocusCarousel, type FocusSlide } from "@/components/ui/focus-carousel";
import { SportBadge } from "@/components/ui/sport-badge";
import { GROUP_KPIS } from "@/dashboard.config";
import { sportsInRange } from "@/lib/charts/all-sports";
import { buildBricks } from "@/lib/charts/bricks";
import { trainingTiles } from "@/lib/dashboard/week-so-far";
import type { DashboardData } from "@/lib/dashboard/types";
import { intensitySplit } from "@/lib/progress/build";
import { progressWeek } from "@/lib/progress/week";
import type { ActiveSport, SportFilter } from "@/lib/sport";

/**
 * Training: am I getting fitter? The week so far (time by sport, run miles, ride time, easy
 * share, load ratio), then the week's intensity to swipe through (easy vs hard, HR zones, what
 * the sessions trained, bricks), then a group per sport and one for load, each its number tiles
 * then its charts, driven by the range control.
 */
export function TrainingTab({ data }: { data: DashboardData }) {
  const week = progressWeek(data.week, data.today);
  // The swipeable section follows the picked week, whatever the range below.
  const weekData: DashboardData = { ...data, dateRange: { key: "week", from: week.monday, to: week.sunday } };
  const bricks = buildBricks(weekData);
  const sports = sportsInRange(data);
  const share = (render: (d: DashboardData) => ReactNode) => <Shared data={data} sports={sports} render={render} />;
  const slides: FocusSlide[] = [
    { key: "intensity", title: "Easy vs hard", node: <IntensityCard split={intensitySplit(data, week)} /> },
    { key: "zones", title: "HR zones", node: <ZonesChart data={weekData} /> },
    { key: "mix", title: "Sessions trained", node: <SessionMixCard data={weekData} /> },
    ...(bricks ? [{ key: "bricks", title: "Bricks", node: <BrickCard bricks={bricks} /> }] : []),
  ];

  return (
    <>
      <WeekSoFar week={week} tiles={trainingTiles(data, week)} />
      <FocusCarousel slides={slides} />

      <Section id="running">
        <SectionHeadingRow n="01" control={<RangeControl current={data.dateRange} tab="training" sport="all" today={data.today} />}>
          <SportHeading sport="run">Running: am I getting faster?</SportHeading>
        </SectionHeadingRow>
        <KpiCards data={data} ids={GROUP_KPIS.run} columns={4} />
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
        <SectionHeading n="02">
          <SportHeading sport="ride">Riding: is my power going up?</SportHeading>
        </SectionHeading>
        <KpiCards data={data} ids={GROUP_KPIS.ride} columns={4} />
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

      <Section id="load">
        <SectionHeading n="03">How much am I training?</SectionHeading>
        <KpiCards data={data} ids={GROUP_KPIS.load} columns={3} />
        <CardGrid>
          <Cell span={12}>{share((d) => <TrainingLoadChart data={d} />)}</Cell>
          <Cell span={12}>
            <WeeklyVolumeChart data={data} />
          </Cell>
        </CardGrid>
      </Section>

      <Section id="swimming">
        <SectionHeading n="04">
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
