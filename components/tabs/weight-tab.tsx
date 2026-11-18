import { GoalProjectionChart } from "@/components/charts/goal-projection-chart";
import { WeeklyLossChart } from "@/components/charts/weekly-loss-chart";
import { WeightTrendChart } from "@/components/charts/weight-trend-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { WeekSoFar } from "@/components/dashboard/week-so-far";
import { WeighInTable } from "@/components/dashboard/weigh-in-table";
import { WeightHeatmap } from "@/components/heatmap/heatmaps";
import { InsightCard } from "@/components/insights/insight-card";
import { DailySummary } from "@/components/today/daily-summary";
import { FocusCarousel, type FocusSlide } from "@/components/ui/focus-carousel";
import { TAB_KPIS } from "@/dashboard.config";
import { weightTiles } from "@/lib/dashboard/week-so-far";
import type { DashboardData } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { buildWeightInsights } from "@/lib/insights/weight";
import { progressWeek } from "@/lib/progress/week";

/** The swipeable trend charts show this many weeks to the picked week's end, whatever the range. */
const TREND_WEEKS = 12;

/**
 * Weight: is it coming off the right way? The week so far (7-day average, weigh-ins, rate
 * against plan, progress to goal), then the trend, projection and weekly loss over the last 12
 * weeks to swipe through, then where things stand (the summary, the cards, what the pace and
 * the muscle mean) and what was logged, driven by the range control.
 */
export function WeightTab({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const week = progressWeek(data.week, data.today);
  const trendData: DashboardData = { ...data, dateRange: { key: "custom", from: addDays(week.sunday, -7 * TREND_WEEKS + 1), to: week.sunday } };
  const insights = buildWeightInsights(data);
  const slides: FocusSlide[] = [
    { key: "trend", title: "Trend", node: <WeightTrendChart data={trendData} /> },
    { key: "projection", title: "Projection", node: <GoalProjectionChart data={trendData} /> },
    { key: "loss", title: "Weekly loss", node: <WeeklyLossChart data={trendData} /> },
  ];
  return (
    <>
      <WeekSoFar week={week} tiles={weightTiles(data, week)} />
      <FocusCarousel slides={slides} />
      <Section id="today-weight">
        <SectionHeadingRow n="01" control={<RangeControl current={data.dateRange} tab="weight" sport="all" today={data.today} />}>
          Where am I today?
        </SectionHeadingRow>
        <DailySummary data={data} />
        <KpiCards data={data} ids={TAB_KPIS.weight ?? []} />
        {insights.length > 0 && (
          <CardGrid>
            {insights.map((insight) => (
              <Cell key={insight.id} span={insights.length === 3 ? 4 : 6}>
                <InsightCard insight={insight} />
              </Cell>
            ))}
          </CardGrid>
        )}
      </Section>
      <Section id="weigh-ins">
        <SectionHeading n="02">What did I log?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <WeightHeatmap data={data} />
          </Cell>
          <Cell span={12}>
            <WeighInTable data={data} canEdit={canEdit} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
