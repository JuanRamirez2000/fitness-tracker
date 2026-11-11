import type { ReactNode } from "react";
import { BestEffortsCard } from "@/components/charts/best-efforts-card";
import { EngineTrendChart } from "@/components/charts/engine-trend-chart";
import { FitnessChart } from "@/components/charts/fitness-chart";
import { LoadFocusCard } from "@/components/charts/load-focus-card";
import { PowerCurveCard } from "@/components/charts/power-curve-card";
import { PowerZonesCard } from "@/components/charts/power-zones-card";
import { RaceChart } from "@/components/charts/race-chart";
import { RideEfficiencyChart } from "@/components/charts/ride-efficiency-chart";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { SessionCostChart } from "@/components/charts/session-cost-chart";
import { SessionMixCard } from "@/components/charts/session-mix-card";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { ZonesChart } from "@/components/charts/zones-chart";
import { ActivitiesTable } from "@/components/dashboard/activities-table";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { SportSwitch } from "@/components/dashboard/sport-switch";
import { SportToggle } from "@/components/dashboard/sport-toggle";
import { ActivityHeatmap } from "@/components/heatmap/heatmaps";
import { DailySummary } from "@/components/today/daily-summary";
import { SportBadge } from "@/components/ui/sport-badge";
import { TRAINING_KPIS } from "@/dashboard.config";
import { sportsInRange } from "@/lib/charts/all-sports";
import type { DashboardData } from "@/lib/dashboard/types";
import type { UrlRange } from "@/lib/range/url";
import { SPORT_NOUN, SPORT_STYLE, sportsIn, type ActiveSport, type SportFilter } from "@/lib/sport";

/**
 * Training under the All | Ride | Run (| Swim) filter. A Shared section first (the cards every
 * sport feeds), then one section per sport. Under All, each shared card carries its own sport
 * switch and every sport with activities gets its section; under one sport, the shared cards are
 * locked to it and only its section follows. Sections come from SPORT_SECTIONS, so a new sport
 * is one more entry there.
 */
export function TrainingTab({ data, urlRange }: { data: DashboardData; urlRange: UrlRange | null }) {
  // The filter offers sports trained since the program began (old swims from before it stay out).
  const filterSports = sportsIn(data.activities.filter((a) => a.local_date >= data.programStart));
  const rangeSports = sportsInRange(data);
  const sections: ActiveSport[] = data.sport === "all" ? filterSports : [data.sport];
  const share = (render: (d: DashboardData) => ReactNode) => <Shared data={data} sports={rangeSports} render={render} />;

  return (
    <>
      <DailySummary data={data} />
      <SportToggle current={data.sport} range={urlRange} sports={filterSports} />
      <KpiCards data={data} ids={TRAINING_KPIS[data.sport]} />
      <Section>
        <SectionHeading n="01">{data.sport === "all" ? "Am I getting fitter overall?" : "Am I getting fitter?"}</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <WeeklyVolumeChart data={data} />
          </Cell>
          <Cell span={6}>{share((d) => <FitnessChart data={d} />)}</Cell>
          <Cell span={6}>
            <EngineTrendChart data={data} />
          </Cell>
          <Cell span={6}>{share((d) => <TrainingLoadChart data={d} />)}</Cell>
          <Cell span={6}>
            <LoadFocusCard data={data} />
          </Cell>
          <Cell span={6}>{share((d) => <ZonesChart data={d} />)}</Cell>
          <Cell span={6}>
            <SessionCostChart data={data} />
          </Cell>
          <Cell span={12}>
            <SessionMixCard data={data} />
          </Cell>
          <Cell span={12}>
            <ActivityHeatmap data={data} />
          </Cell>
          <Cell span={12}>
            <ActivitiesTable data={data} />
          </Cell>
        </CardGrid>
      </Section>
      {sections.map((sport, i) => (
        <Section key={sport}>
          <SectionHeading n={String(i + 2).padStart(2, "0")}>
            <span className="inline-flex flex-wrap items-center gap-3">
              {SPORT_SECTIONS[sport].title}
              <SportBadge sport={sport} className="align-middle" />
            </span>
          </SectionHeading>
          <CardGrid>
            {rangeSports.includes(sport) ? (
              SPORT_SECTIONS[sport].cards(data)
            ) : (
              <Cell span={12}>
                <QuietSport sport={sport} />
              </Cell>
            )}
          </CardGrid>
        </Section>
      ))}
    </>
  );
}

/**
 * A shared card: under All with two or more sports in the range, rendered once per option (All,
 * then each sport) inside a SportSwitch; otherwise once, under the page's own filter.
 */
function Shared({ data, sports, render }: { data: DashboardData; sports: ActiveSport[]; render: (d: DashboardData) => ReactNode }) {
  if (data.sport !== "all" || sports.length < 2) return <>{render(data)}</>;
  const panels: Partial<Record<SportFilter, ReactNode>> = { all: render(data) };
  for (const sport of sports) panels[sport] = render({ ...data, sport });
  return <SportSwitch panels={panels} />;
}

/** Each sport's own section: its question and its cards (the data is already the full set; each
 * card picks its sport's activities itself). */
const SPORT_SECTIONS: Record<ActiveSport, { title: string; cards: (data: DashboardData) => ReactNode }> = {
  ride: {
    title: "Cycling: power and efficiency",
    cards: (data) => (
      <>
        <Cell span={12}>
          <PowerCurveCard data={data} />
        </Cell>
        <Cell span={6}>
          <RideEfficiencyChart data={data} />
        </Cell>
        <Cell span={6}>
          <PowerZonesCard data={data} />
        </Cell>
      </>
    ),
  },
  run: {
    title: "Running: speed and efficiency",
    cards: (data) => (
      <>
        <Cell span={6}>
          <RaceChart data={data} />
        </Cell>
        <Cell span={6}>
          <RunEfficiencyChart data={data} />
        </Cell>
        <Cell span={12}>
          <BestEffortsCard data={data} />
        </Cell>
      </>
    ),
  },
  swim: {
    title: "Swimming",
    // The swim charts (pace per 100 yd, SWOLF, stroke rate) wait for real swims (January 2027).
    cards: () => (
      <Cell span={12}>
        <div className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-[12.5px] text-muted-2 md:px-6">
          Swim charts (pace per 100 yards, SWOLF, stroke rate) come once a few swims have synced. Until then your swims count in every shared card above.
        </div>
      </Cell>
    ),
  },
};

/** One line in place of a sport's charts when the range has none of it. */
function QuietSport({ sport }: { sport: ActiveSport }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-border-strong px-4 py-3 md:px-6">
      <SportBadge sport={sport} />
      <span className="text-[12.5px] text-muted-2">
        No {SPORT_NOUN[sport].many} in this range, so the {SPORT_STYLE[sport].verb} charts are folded away.
      </span>
    </div>
  );
}
