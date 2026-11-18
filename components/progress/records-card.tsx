import { ChartCard, ChartEmpty } from "@/components/charts/chart-card";
import { fmtDate } from "@/lib/dates/format";
import type { RecordEvent } from "@/lib/progress/records";
import { RecordRows } from "./record-rows";

const HELP =
  "Every record you've set since the program began: your fastest mile, 2 miles and 5K inside any run, the longest run, best power for 5 seconds up to an hour, the longest ride and swim, VO2 max highs and your biggest training week. Milestones mark running miles and training hours adding up since you started. Click a row set in an activity to open it.";

/** A list of records and milestones; `latest` is what to point at when the list is empty. */
export function RecordsCard({
  title,
  subtitle,
  records,
  latest,
  empty,
}: {
  title: string;
  subtitle: string;
  records: RecordEvent[];
  latest: RecordEvent | null;
  empty: string;
}) {
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle}>
      {records.length ? (
        <RecordRows records={records} />
      ) : (
        <ChartEmpty>{latest ? `${empty} The last one: ${latest.title.toLowerCase()}, ${fmtDate(latest.date)}.` : empty}</ChartEmpty>
      )}
    </ChartCard>
  );
}
