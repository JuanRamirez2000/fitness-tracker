import { TAB_KPIS } from "@/dashboard.config";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { HeartChart } from "@/components/charts/heart-chart";
import { SleepChart } from "@/components/charts/sleep-chart";
import { CardGrid, Cell, Section, SectionHeading, SectionLabel } from "@/components/dashboard/layout";
import { DailySummary } from "@/components/today/daily-summary";
import { TodayHero } from "@/components/today/today-hero";
import type { DashboardData } from "@/lib/dashboard/types";
import { diffDays } from "@/lib/dates/calendar";

/** The Body Battery card adds history the hero can't; on a week or less it only repeats the hero. */
const BODY_BATTERY_MIN_DAYS = 8;

/** Daily feel: "How am I doing today?" The AI summary and readiness hero, then recovery and sleep detail. */
export function TodayTab({ data }: { data: DashboardData }) {
  const showBattery = diffDays(data.dateRange.to, data.dateRange.from) + 1 >= BODY_BATTERY_MIN_DAYS;
  return (
    <>
      <Section>
        <SectionHeading n="01" rule={false}>
          How am I doing today?
        </SectionHeading>
        <DailySummary data={data} />
        <TodayHero data={data} />
        <KpiCards data={data} ids={TAB_KPIS.today} />
      </Section>
      <Section>
        <SectionLabel>Recovery and sleep detail</SectionLabel>
        <CardGrid>
          <Cell span={6}>
            <SleepChart data={data} />
          </Cell>
          <Cell span={6}>
            <HeartChart data={data} />
          </Cell>
          {showBattery && (
            <Cell span={12}>
              <BodyBatteryChart data={data} />
            </Cell>
          )}
        </CardGrid>
      </Section>
    </>
  );
}
