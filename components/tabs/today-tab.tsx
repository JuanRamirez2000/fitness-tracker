import { Section, SectionHeading } from "@/components/dashboard/layout";
import type { DashboardData } from "@/lib/dashboard/types";

/** Daily feel: "How am I doing today?" The summary, readiness hero and recovery/sleep cards
 * land here once the recovery and sleep import exists; until then, one line says so. */
export function TodayTab({ data }: { data: DashboardData }) {
  void data;
  return (
    <Section>
      <SectionHeading n="01" rule={false}>
        How am I doing today?
      </SectionHeading>
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center font-mono text-[11px] text-muted-2 md:px-[22px]">
        no recovery or sleep data yet
      </div>
    </Section>
  );
}
