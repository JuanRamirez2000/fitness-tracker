import { BodyBatteryChart } from "@/components/charts/body-battery-chart";
import { HeartChart } from "@/components/charts/heart-chart";
import { SleepChart } from "@/components/charts/sleep-chart";
import { CardGrid, Cell, Section, SectionHeading, SectionLabel } from "@/components/dashboard/layout";
import { TodayHero } from "@/components/today/today-hero";
import type { DashboardData } from "@/lib/dashboard/types";

/**
 * Daily feel: "How am I doing today?" The readiness hero, then recovery and sleep detail.
 * (The AI daily summary goes above the hero once it is generated.)
 */
export function TodayTab({ data }: { data: DashboardData }) {
  return (
    <>
      <Section>
        <SectionHeading n="01" rule={false}>
          How am I doing today?
        </SectionHeading>
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
