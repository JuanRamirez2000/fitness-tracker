import { GoalProjectionChart } from "@/components/charts/goal-projection-chart";
import { WeeklyLossChart } from "@/components/charts/weekly-loss-chart";
import { TAB_KPIS } from "@/dashboard.config";
import { WeightTrendChart } from "@/components/charts/weight-trend-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { QuickLook } from "@/components/dashboard/quick-look";
import { InsightCard, ShowTheNumbers } from "@/components/insights/insight-card";
import { DailySummary } from "@/components/today/daily-summary";
import { CardGrid, Cell, Section, SectionHeading } from "@/components/dashboard/layout";
import { WeighInTable } from "@/components/dashboard/weigh-in-table";
import { WeightHeatmap } from "@/components/heatmap/heatmaps";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeightInsights } from "@/lib/insights/weight";

/** Weight: is the weight coming off the right way? The quick-look strip and the summary, then
 * what the pace and the muscle mean (insight cards) and the trend; the weigh-in log is folded
 * behind "Show the numbers". */
export function WeightTab({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const insights = buildWeightInsights(data);
  return (
    <>
      <QuickLook data={data} />
      <DailySummary data={data} />
      <KpiCards data={data} ids={TAB_KPIS.weight} />
      <Section>
        <SectionHeading n="01">Is the weight coming off the right way?</SectionHeading>
        <CardGrid>
          {insights.map((insight) => (
            <Cell key={insight.id} span={insights.length === 3 ? 4 : 6}>
              <InsightCard insight={insight} />
            </Cell>
          ))}
          <Cell span={12}>
            <WeightTrendChart data={data} />
          </Cell>
          <Cell span={6}>
            <GoalProjectionChart data={data} />
          </Cell>
          <Cell span={6}>
            <WeeklyLossChart data={data} />
          </Cell>
          <Cell span={12}>
            <WeightHeatmap data={data} />
          </Cell>
        </CardGrid>
      </Section>
      <ShowTheNumbers>
        <CardGrid>
          <Cell span={12}>
            <WeighInTable data={data} canEdit={canEdit} />
          </Cell>
        </CardGrid>
      </ShowTheNumbers>
    </>
  );
}
