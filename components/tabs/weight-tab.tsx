import { GoalProjectionChart } from "@/components/charts/goal-projection-chart";
import { WeeklyLossChart } from "@/components/charts/weekly-loss-chart";
import { TAB_KPIS } from "@/dashboard.config";
import { WeightTrendChart } from "@/components/charts/weight-trend-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { QuickLook } from "@/components/dashboard/quick-look";
import { InsightCard } from "@/components/insights/insight-card";
import { DailySummary } from "@/components/today/daily-summary";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { WeighInTable } from "@/components/dashboard/weigh-in-table";
import { WeightHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeightInsights } from "@/lib/insights/weight";

/** Weight, in three sections the "On this page" list names: where things stand today (the
 * summary, the cards, what the pace and the muscle mean), whether the weight is coming off the
 * right way (trend, projection, weekly loss), and what was logged (the calendar, the weigh-in
 * log). The quick-look strip above. */
export function WeightTab({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const insights = buildWeightInsights(data);
  return (
    <>
      <QuickLook data={data} />
      <Section id="today-weight">
        <SectionHeading n="01">Where am I today?</SectionHeading>
        <DailySummary data={data} />
        <KpiCards data={data} ids={TAB_KPIS.weight} />
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
      <Section id="trend">
        <SectionHeading n="02">Is the weight coming off the right way?</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <WeightTrendChart data={data} />
          </Cell>
          <Cell span={6}>
            <GoalProjectionChart data={data} />
          </Cell>
          <Cell span={6}>
            <WeeklyLossChart data={data} />
          </Cell>
        </CardGrid>
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
