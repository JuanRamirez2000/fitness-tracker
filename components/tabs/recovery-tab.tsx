import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { MoodChart } from "@/components/charts/mood-chart";
import { SleepChart } from "@/components/charts/sleep-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { WeekSoFar } from "@/components/dashboard/week-so-far";
import { RecoveryHeatmap } from "@/components/heatmap/heatmaps";
import { InsightCard } from "@/components/insights/insight-card";
import { MoodCard } from "@/components/progress/mood-card";
import { RecoveryCard } from "@/components/progress/recovery-card";
import { TodayHero } from "@/components/today/today-hero";
import { FocusCarousel, type FocusSlide } from "@/components/ui/focus-carousel";
import { RECOVERY_KPIS } from "@/dashboard.config";
import { recoveryTiles } from "@/lib/dashboard/week-so-far";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildDailyInsights } from "@/lib/insights/daily";
import { weekMood, weekRecovery } from "@/lib/progress/build";
import { progressWeek } from "@/lib/progress/week";

/**
 * Recovery: how recovered am I? The week so far (readiness, sleep, debt, mood, steps), then
 * today's readiness and the week's nights, mornings and moods to swipe through, then what each
 * signal means and the trends the range control drives (sleep, Body Battery, mood, the year).
 */
export function RecoveryTab({ data }: { data: DashboardData }) {
  const week = progressWeek(data.week, data.today);
  const weekData: DashboardData = { ...data, dateRange: { key: "week", from: week.monday, to: week.sunday } };
  const insights = buildDailyInsights(data);
  const slides: FocusSlide[] = [
    ...(week.current ? [{ key: "today", title: "Today", node: <TodayHero data={data} /> }] : []),
    { key: "nights", title: "Sleep", node: <SleepChart data={weekData} /> },
    { key: "mornings", title: "Mornings", node: <RecoveryCard recovery={weekRecovery(data, week)} week={week} /> },
    { key: "mood", title: "Mood", node: <MoodCard mood={weekMood(data, week)} week={week} /> },
  ];
  return (
    <>
      <WeekSoFar week={week} tiles={recoveryTiles(data, week)} />
      <FocusCarousel slides={slides} />

      <Section id="today-recovery">
        <SectionHeadingRow n="01" control={<RangeControl current={data.dateRange} tab="recovery" sport="all" today={data.today} />}>
          How am I recovering?
        </SectionHeadingRow>
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

      <Section id="recovery-trends">
        <SectionHeading n="02">How has it trended?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <SleepChart data={data} />
          </Cell>
          <Cell span={12}>
            <BodyBatteryChart data={data} />
          </Cell>
          <Cell span={12}>
            <MoodChart data={data} />
          </Cell>
          <Cell span={12}>
            <RecoveryHeatmap data={data} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
