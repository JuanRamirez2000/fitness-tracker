import { GoalProjectionChart } from "@/components/charts/goal-projection-chart";
import { WeeklyLossChart } from "@/components/charts/weekly-loss-chart";
import { WeightTrendChart } from "@/components/charts/weight-trend-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { WeighInTable } from "@/components/dashboard/weigh-in-table";
import { WeightHeatmap } from "@/components/heatmap/heatmaps";
import { WEIGHT_KPIS } from "@/dashboard.config";
import type { DashboardData } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { progressWeek } from "@/lib/progress/week";

/** The trend charts show this many weeks to the picked week's end, whatever the range. */
const TREND_WEEKS = 12;

/**
 * Weight: is it coming off the right way? (docs/plan-four-tabs.md) The trend, projection and
 * weekly loss over the last 12 weeks, then the key numbers and what was logged, driven by the
 * range control.
 */
export function WeightTab({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const week = progressWeek(data.week, data.today);
  const trendData: DashboardData = { ...data, dateRange: { key: "custom", from: addDays(week.sunday, -7 * TREND_WEEKS + 1), to: week.sunday } };
  return (
    <>
      <Section id="weight-trend">
        <SectionHeading n="01">Is it coming off the right way?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <WeightTrendChart data={trendData} />
          </Cell>
          <Cell span={6}>
            <GoalProjectionChart data={trendData} />
          </Cell>
          <Cell span={6}>
            <WeeklyLossChart data={trendData} />
          </Cell>
        </CardGrid>
      </Section>
      <Section id="today-weight">
        <SectionHeadingRow n="02" control={<RangeControl current={data.dateRange} tab="weight" sport="all" today={data.today} />}>
          Where am I today?
        </SectionHeadingRow>
        <KpiCards data={data} ids={WEIGHT_KPIS} />
      </Section>
      <Section id="weigh-ins">
        <SectionHeading n="03">What did I log?</SectionHeading>
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
