import { TAB_KPIS } from "@/dashboard.config";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { ReadinessChart } from "@/components/charts/readiness-chart";
import { SleepTimingChart } from "@/components/charts/sleep-timing-chart";
import { RecoveryHeatmap } from "@/components/heatmap/heatmaps";
import { HeartChart } from "@/components/charts/heart-chart";
import { SleepChart } from "@/components/charts/sleep-chart";
import { CardGrid, Cell, Section, SectionHeading, SectionLabel } from "@/components/dashboard/layout";
import { InsightCard, ShowTheNumbers } from "@/components/insights/insight-card";
import { DailySummary } from "@/components/today/daily-summary";
import { TodayHero } from "@/components/today/today-hero";
import type { DashboardData } from "@/lib/dashboard/types";
import { diffDays } from "@/lib/dates/calendar";
import { buildDailyInsights } from "@/lib/insights/daily";

/** The Body Battery card adds history the hero can't; on a week or less it only repeats the hero. */
const BODY_BATTERY_MIN_DAYS = 8;

/** Daily feel: "How am I doing today?" The AI summary, readiness hero, then what each signal means
 * and one thing to do about it (insight cards); the raw cards, charts and calendar are folded
 * behind "Show the numbers". */
export function TodayTab({ data }: { data: DashboardData }) {
  const showBattery = diffDays(data.dateRange.to, data.dateRange.from) + 1 >= BODY_BATTERY_MIN_DAYS;
  const insights = buildDailyInsights(data);
  return (
    <>
      <Section>
        <SectionHeading n="01" rule={false}>
          How am I doing today?
        </SectionHeading>
        <DailySummary data={data} />
        <TodayHero data={data} />
        {insights.length > 0 && (
          <CardGrid>
            {insights.map((insight) => (
              <Cell key={insight.id} span={6}>
                <InsightCard insight={insight} />
              </Cell>
            ))}
          </CardGrid>
        )}
      </Section>
      <ShowTheNumbers>
        <KpiCards data={data} ids={TAB_KPIS.today} />
        <SectionLabel>Recovery and sleep detail</SectionLabel>
        <CardGrid>
          <Cell span={12}>
            <ReadinessChart data={data} />
          </Cell>
          <Cell span={6}>
            <SleepChart data={data} />
          </Cell>
          <Cell span={6}>
            <SleepTimingChart data={data} />
          </Cell>
          {/* Body Battery only adds history on longer ranges; on a week the heart chart takes the row. */}
          <Cell span={showBattery ? 6 : 12}>
            <HeartChart data={data} />
          </Cell>
          {showBattery && (
            <Cell span={6}>
              <BodyBatteryChart data={data} />
            </Cell>
          )}
          <Cell span={12}>
            <RecoveryHeatmap data={data} />
          </Cell>
        </CardGrid>
      </ShowTheNumbers>
    </>
  );
}
