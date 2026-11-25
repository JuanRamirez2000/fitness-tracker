import { ActivitiesTable } from "@/components/dashboard/activities-table";
import { CardGrid, Cell, Section, SectionHeading, SectionHeadingRow } from "@/components/dashboard/layout";
import { RangeControl } from "@/components/dashboard/range-control";
import { ActivityHeatmap, RecoveryHeatmap, WeightHeatmap } from "@/components/heatmap/heatmaps";
import { DayTable } from "@/components/log/day-table";
import { MonthGrid } from "@/components/log/month-grid";
import { RecordsCard } from "@/components/progress/records-card";
import type { DashboardData } from "@/lib/dashboard/types";
import { addDays } from "@/lib/dates/calendar";
import { buildDays } from "@/lib/log/days";
import { buildRecords } from "@/lib/progress/records";
import { progressWeek } from "@/lib/progress/week";

const RECORDS_SHOWN = 20;

/**
 * Log: what data is there? It repeats the other tabs on purpose. The month around the picked
 * week, the year heatmaps (the recovery calendar among them), every day's numbers, every
 * activity and every record, driven by the range control.
 */
export function LogTab({ data }: { data: DashboardData }) {
  const week = progressWeek(data.week, data.today);
  const monthStart = `${week.through.slice(0, 7)}-01`;
  const month = buildDays(data, addDays(monthStart, -7), addDays(monthStart, 41));
  const days = buildDays(data, data.dateRange.from, data.dateRange.to);
  const all = buildRecords(data);
  const records = all.filter((r) => r.date >= data.dateRange.from && r.date <= data.dateRange.to);
  return (
    <>
      <Section id="calendar">
        <SectionHeadingRow n="01" control={<RangeControl current={data.dateRange} tab="log" sport="all" today={data.today} />}>
          What&apos;s on the calendar?
        </SectionHeadingRow>
        <CardGrid>
          <Cell span={12}>
            <MonthGrid month={week.through} days={month} today={data.today} />
          </Cell>
          <Cell span={12}>
            <ActivityHeatmap data={data} />
          </Cell>
          <Cell span={12}>
            <RecoveryHeatmap data={data} />
          </Cell>
          <Cell span={12}>
            <WeightHeatmap data={data} />
          </Cell>
        </CardGrid>
      </Section>

      <Section id="days">
        <SectionHeading n="02">What did each day look like?</SectionHeading>
        <DayTable days={days} />
      </Section>

      <Section id="activities">
        <SectionHeading n="03">Every activity and record</SectionHeading>
        <CardGrid>
          <Cell span={12}>
            <ActivitiesTable data={data} />
          </Cell>
          <Cell span={12}>
            <RecordsCard
              title="Records"
              subtitle={records.length > RECORDS_SHOWN ? `The latest ${RECORDS_SHOWN} of ${records.length} in this range` : "Personal bests and milestones in this range"}
              records={records.slice(0, RECORDS_SHOWN)}
              latest={all[0] ?? null}
              empty="No records in this range."
            />
          </Cell>
        </CardGrid>
      </Section>
    </>
  );
}
