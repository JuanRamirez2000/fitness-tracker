import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { HeartChart } from "@/components/charts/heart-chart";
import { SleepChart } from "@/components/charts/sleep-chart";
import { CardGrid, Cell, Section, SectionHeading, SectionLabel } from "@/components/dashboard/layout";
import { DailySummary } from "@/components/today/daily-summary";
import { TodayHero } from "@/components/today/today-hero";
import type { DashboardData } from "@/lib/dashboard/types";

/** Daily feel: "How am I doing today?" The AI summary and readiness hero, then recovery and sleep detail. */
export function TodayTab({ data }: { data: DashboardData }) {
  return (
    <>
      <Section>
        <SectionHeading n="01" rule={false}>
          How am I doing today?
        </SectionHeading>
        <DailySummary data={data} />
        <TodayHero data={data} />
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
          <Cell span={12}>
            <BodyBatteryChart data={data} />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
