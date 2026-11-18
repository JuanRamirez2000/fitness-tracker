import type { ReactNode } from "react";
import { BestEffortsCard } from "@/components/charts/best-efforts-card";
import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { BrickCard } from "@/components/charts/brick-card";
import { FitnessChart } from "@/components/charts/fitness-chart";
import { LoadFocusCard } from "@/components/charts/load-focus-card";
import { MoodChart } from "@/components/charts/mood-chart";
import { PowerCurveCard } from "@/components/charts/power-curve-card";
import { PowerZonesCard } from "@/components/charts/power-zones-card";
import { RaceChart } from "@/components/charts/race-chart";
import { RideEfficiencyChart } from "@/components/charts/ride-efficiency-chart";
import { RunEfficiencyChart } from "@/components/charts/run-efficiency-chart";
import { SessionMixCard } from "@/components/charts/session-mix-card";
import { SleepChart } from "@/components/charts/sleep-chart";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { WeeklyVolumeChart } from "@/components/charts/weekly-volume-chart";
import { ZonesChart } from "@/components/charts/zones-chart";
import { ActivitiesTable } from "@/components/dashboard/activities-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { QuickLook } from "@/components/dashboard/quick-look";
import { RangeControl } from "@/components/dashboard/range-control";
import { SportSwitch } from "@/components/dashboard/sport-switch";
import { SportToggle } from "@/components/dashboard/sport-toggle";
import { WeekPicker } from "@/components/dashboard/week-picker";
import { ActivityHeatmap } from "@/components/heatmap/heatmaps";
import { InsightCard, ShowTheNumbers } from "@/components/insights/insight-card";
import { HoursChart } from "@/components/progress/hours-chart";
import { IntensityCard } from "@/components/progress/intensity-card";
import { MoodCard } from "@/components/progress/mood-card";
import { PlanCard } from "@/components/progress/plan-card";
import { PlanProgressCard } from "@/components/progress/plan-progress-card";
import { RampNotice } from "@/components/progress/ramp-notice";
import { RecordsCard } from "@/components/progress/records-card";
import { RecoveryCard } from "@/components/progress/recovery-card";
import { WeeklyReview } from "@/components/progress/weekly-review";
import { DailySummary } from "@/components/today/daily-summary";
import { TodayHero } from "@/components/today/today-hero";
import { SportBadge } from "@/components/ui/sport-badge";
import { WeekPlanner } from "@/components/workouts/week-planner";
import { FocusCarousel, type FocusSlide } from "@/components/ui/focus-carousel";
import { RECOVERY_KPIS, TRAINING_KPIS } from "@/dashboard.config";
import { sportsInRange } from "@/lib/charts/all-sports";
import { buildBricks } from "@/lib/charts/bricks";
import type { DashboardData, KpiValue } from "@/lib/dashboard/types";
import { buildDailyInsights } from "@/lib/insights/daily";
import { hoursBySport, intensitySplit, loadCard, planVsDone, readinessCard, weekMood, weekRecovery, weekWeightCard } from "@/lib/progress/build";
import { planProgress } from "@/lib/progress/plans";
import { buildRecords } from "@/lib/progress/records";
import { progressWeek, type ProgressWeek } from "@/lib/progress/week";
import type { UrlRange } from "@/lib/range/url";
import { runRamp } from "@/lib/running/ramp";
import { SPORT_NOUN, SPORT_STYLE, sportsIn, type ActiveSport, type SportFilter } from "@/lib/sport";

const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}`;

/**
 * The one training dashboard (docs/plan-layout.md): the quick-look strip, then the picked week
 * (`?week=`: the review, the plans, plan vs done, records, recovery, mood and weight), what's
 * next (the summary and the planner), today's recovery, and then everything the range control
 * drives: fitness under the All | Ride | Run (| Swim) filter, one section per sport, and the log.
 * Under All, each shared card carries its own sport switch; under one sport, the shared cards
 * are locked to it and only its section follows.
 */
export function TrainingTab({ data, urlRange, canEdit }: { data: DashboardData; urlRange: UrlRange | null; canEdit: boolean }) {
  const week = progressWeek(data.week, data.today);
  // The filter offers sports trained since the program began (old swims from before it stay out).
  const filterSports = sportsIn(data.activities.filter((a) => a.local_date >= data.programStart));
  const rangeSports = sportsInRange(data);
  const sections: ActiveSport[] = data.sport === "all" ? filterSports : [data.sport];
  const share = (render: (d: DashboardData) => ReactNode) => <Shared data={data} sports={rangeSports} render={render} />;
  // Ride-then-run sessions: hidden until the first brick, and under the swim filter.
  const bricks = data.sport === "swim" ? null : buildBricks(data);
  const weekParam = week.current ? null : week.monday;
  let n = 0;
  const next = () => String(++n).padStart(2, "0");

  return (
    <>
      <QuickLook data={data} />
      <WeekSection data={data} week={week} urlRange={urlRange} n={next()} />

      <Section id="next">
        <SectionHeading n={next()}>What&apos;s next?</SectionHeading>
        <DailySummary data={data} />
        {data.planner && <WeekPlanner planner={data.planner} canEdit={canEdit} />}
      </Section>

      <RecoverySection data={data} n={next()} showHero={!week.current} />

      <Section id="fitness">
        <SectionHeadingRow
          n={next()}
          control={<RangeControl current={data.dateRange} tab="training" sport={data.sport} today={data.today} />}
        >
          {data.sport === "all" ? "Am I getting fitter overall?" : "Am I getting fitter?"}
        </SectionHeadingRow>
        <SportToggle current={data.sport} range={urlRange} sports={filterSports} week={weekParam} />
        <KpiCards data={data} ids={TRAINING_KPIS[data.sport]} />
        <CardGrid>
          <Cell span={12}>
            <WeeklyVolumeChart data={data} />
          </Cell>
          <Cell span={6}>{share((d) => <FitnessChart data={d} />)}</Cell>
          <Cell span={6}>{share((d) => <TrainingLoadChart data={d} />)}</Cell>
          <Cell span={6}>
            <LoadFocusCard data={data} />
          </Cell>
          <Cell span={6}>{share((d) => <ZonesChart data={d} />)}</Cell>
          <Cell span={12}>
            <SessionMixCard data={data} />
          </Cell>
          {bricks && (
            <Cell span={12}>
              <BrickCard bricks={bricks} />
            </Cell>
          )}
          <Cell span={12}>
            <BodyBatteryChart data={data} />
          </Cell>
        </CardGrid>
        <ShowTheNumbers label="Sleep and mood over the range">
          <CardGrid>
            <Cell span={12}>
              <SleepChart data={data} />
            </Cell>
            <Cell span={12}>
              <MoodChart data={data} />
            </Cell>
          </CardGrid>
        </ShowTheNumbers>
      </Section>

      {sections.map((sport) => (
        <Section key={sport}>
          <SectionHeading n={next()}>
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

      <Section id="log">
        <SectionHeading n={next()}>What did I do?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <ActivityHeatmap data={data} />
          </Cell>
          <Cell span={12}>
            <RecordsFeed data={data} />
          </Cell>
          <Cell span={12}>
            <ActivitiesTable data={data} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}

/** The picked week: its review, how much and how it went, the plans, the plan against what was
 * done, records, the mornings and the mood, weight, and the hours and intensity behind it. */
function WeekSection({ data, week, urlRange, n }: { data: DashboardData; week: ProgressWeek; urlRange: UrlRange | null; n: string }) {
  const load = loadCard(data.activities, week);
  const readiness = readinessCard(data, week);
  const weight = weekWeightCard(data, week);
  const plans = planProgress(data, week.through);
  // A run plan's card carries the mileage check; without one it stands alone (this week only).
  const ramp = week.current ? runRamp(data.activities, data.today) : null;
  const records = buildRecords(data).filter((r) => r.date <= week.sunday);
  const weekRecords = records.filter((r) => r.date >= week.monday);
  // In focus: today's readiness (this week only), each plan, then the week's views.
  const slides: FocusSlide[] = [
    ...(week.current ? [{ key: "today", title: "Today", node: <TodayHero data={data} /> }] : []),
    ...plans.map((p) => ({ key: p.key, title: p.who, node: <PlanProgressCard plan={p} /> })),
    { key: "plan", title: "Plan vs done", node: <PlanCard plan={planVsDone(data, week)} week={week} /> },
    {
      key: "records",
      title: weekRecords.length ? `Records · ${weekRecords.length}` : "Records",
      node: (
        <RecordsCard
          title={week.current ? "Records this week" : "Records that week"}
          subtitle="Personal bests and milestones set in the week"
          records={weekRecords}
          latest={records[0] ?? null}
          empty={week.current ? "No new records this week." : "No records that week."}
        />
      ),
    },
    { key: "hours", title: "Hours", node: <HoursChart hours={hoursBySport(data, week)} /> },
    { key: "intensity", title: "Easy vs hard", node: <IntensityCard split={intensitySplit(data, week)} /> },
  ];
  return (
    <Section id="week">
      <SectionHeadingRow
        n={n}
        control={<WeekPicker week={data.week} today={data.today} programStart={data.programStart} range={urlRange} sport={data.sport} />}
      >
        {week.current ? "How's my week going?" : "How did that week go?"}
      </SectionHeadingRow>
      <WeeklyReview summary={data.weeklySummary} week={week} timezone={data.profile.timezone} range={urlRange} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label={week.current ? "Load so far" : "Training load"}
          visual="sparkline"
          value={load}
          formatted={{ primary: String(load.value), delta: load.delta === undefined ? undefined : signed(load.delta, "%"), tone: load.tone }}
        />
        <KpiCard
          label="Readiness and mood"
          visual="sparkline"
          emptyMessage="No readiness this week yet"
          value={readiness}
          formatted={readiness && fmt(readiness, readiness.delta === undefined ? undefined : `${signed(readiness.delta)} vs last week`)}
        />
        <KpiCard
          label="Weight this week"
          visual="sparkline"
          emptyMessage="No weigh-in this week yet"
          value={weight}
          formatted={weight && fmt(weight, weight.delta === undefined ? undefined : `${signed(weight.delta, " lb")}`)}
        />
      </div>
      {ramp?.warn && !plans.some((p) => p.sport === "run") && <RampNotice ramp={ramp} />}
      <FocusCarousel slides={slides} />
      <CardGrid>
        <Cell span={6}>
          <RecoveryCard recovery={weekRecovery(data, week)} week={week} />
        </Cell>
        <Cell span={6}>
          <MoodCard mood={weekMood(data, week)} week={week} />
        </Cell>
      </CardGrid>
    </Section>
  );
}

/** Today's readiness and what drove it (in the week's carousel when the week is this one), what
 * each signal means (the insight cards), and sleep and steps. */
function RecoverySection({ data, n, showHero }: { data: DashboardData; n: string; showHero: boolean }) {
  const insights = buildDailyInsights(data);
  return (
    <Section id="recovery">
      <SectionHeading n={n}>How am I recovering today?</SectionHeading>
      {showHero && <TodayHero data={data} />}
      {insights.length > 0 && (
        <CardGrid>
          {insights.map((insight) => (
            <Cell key={insight.id} span={6}>
              <InsightCard insight={insight} />
            </Cell>
          ))}
        </CardGrid>
      )}
      <KpiCards data={data} ids={RECOVERY_KPIS} columns={3} />
    </Section>
  );
}

function fmt(value: KpiValue, delta: string | undefined) {
  return { primary: String(value.value), delta, tone: value.tone };
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

/** Records and milestones in the selected range, under the sport filter, newest first. */
const FEED_LENGTH = 10;
function RecordsFeed({ data }: { data: DashboardData }) {
  const all = buildRecords(data).filter((r) => data.sport === "all" || r.sport === data.sport || r.sport === null);
  const inRange = all.filter((r) => r.date >= data.dateRange.from && r.date <= data.dateRange.to);
  return (
    <RecordsCard
      title="Records"
      subtitle={inRange.length > FEED_LENGTH ? `The latest ${FEED_LENGTH} of ${inRange.length} in this range` : "Personal bests and milestones in this range"}
      records={inRange.slice(0, FEED_LENGTH)}
      latest={all[0] ?? null}
      empty="No records in this range."
    />
  );
}
