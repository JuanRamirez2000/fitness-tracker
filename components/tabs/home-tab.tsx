import Link from "next/link";
import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { MoodChart } from "@/components/charts/mood-chart";
import { SleepChart } from "@/components/charts/sleep-chart";
import { WeightTrendChart } from "@/components/charts/weight-trend-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { WeekTrainingCard } from "@/components/dashboard/week-training-card";
import { MoodCard } from "@/components/progress/mood-card";
import { RampNotice } from "@/components/progress/ramp-notice";
import { RecoveryCard } from "@/components/progress/recovery-card";
import { TodayHero } from "@/components/today/today-hero";
import { WeekPlanner } from "@/components/workouts/week-planner";
import { HOME_KPIS } from "@/dashboard.config";
import { homeTiles } from "@/lib/dashboard/week-so-far";
import type { DashboardData } from "@/lib/dashboard/types";
import { addDays, mondayOf } from "@/lib/dates/calendar";
import { weekMood, weekRecovery } from "@/lib/progress/build";
import { progressWeek } from "@/lib/progress/week";
import { tabToSearchParams, type UrlRange } from "@/lib/range/url";
import { runRamp } from "@/lib/running/ramp";

/** The weight trend shows this many weeks to the picked week's end, whatever the range. */
const TREND_WEEKS = 12;

/**
 * Home: what's next, how am I today, and how's everything going (docs/plan-four-tabs.md). The
 * next 7 days to plan in, today's readiness beside the picked week's training, the key numbers,
 * the weight trend, then recovery: the week's mornings and moods and the trends the range
 * control drives.
 */
export function HomeTab({ data, urlRange, canEdit }: { data: DashboardData; urlRange: UrlRange | null; canEdit: boolean }) {
  const week = progressWeek(data.week, data.today);
  const ramp = week.current ? runRamp(data.activities, data.today) : null;
  const trendData: DashboardData = { ...data, dateRange: { key: "custom", from: addDays(week.sunday, -7 * TREND_WEEKS + 1), to: week.sunday } };
  const weightHref = `/?${tabToSearchParams("weight", urlRange, data.week < mondayOf(data.today) ? data.week : null)}`;
  return (
    <>
      <section id="next-7-days" aria-label="Next 7 days" className="flex scroll-mt-28 flex-col gap-3.5">
        {ramp?.warn && <RampNotice ramp={ramp} />}
        {data.planner && <WeekPlanner planner={data.planner} canEdit={canEdit} />}
      </section>

      <Section id="today">
        <SectionHeading n="01">{week.current ? "How am I today?" : "How did that week go?"}</SectionHeading>
        <CardGrid>
          <Cell span={6}>
            <TodayHero data={data} />
          </Cell>
          <Cell span={6}>
            <WeekTrainingCard week={week} tiles={homeTiles(data, week)} />
          </Cell>
        </CardGrid>
        <KpiCards data={data} ids={HOME_KPIS} columns={4} />
      </Section>

      <Section id="weight">
        <SectionHeadingRow
          n="02"
          control={
            <Link href={weightHref} className="text-[12.5px] text-muted-2 hover:text-ink">
              Weight tab →
            </Link>
          }
        >
          Is the weight coming off?
        </SectionHeadingRow>
        <WeightTrendChart data={trendData} />
      </Section>

      <Section id="recovery">
        <SectionHeadingRow n="03" control={<RangeControl current={data.dateRange} tab="home" sport="all" today={data.today} />}>
          How am I recovering?
        </SectionHeadingRow>
        <CardGrid>
          <Cell span={6}>
            <RecoveryCard recovery={weekRecovery(data, week)} week={week} />
          </Cell>
          <Cell span={6}>
            <MoodCard mood={weekMood(data, week)} week={week} />
          </Cell>
          <Cell span={12}>
            <SleepChart data={data} />
          </Cell>
          <Cell span={12}>
            <BodyBatteryChart data={data} />
          </Cell>
          <Cell span={12}>
            <MoodChart data={data} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
