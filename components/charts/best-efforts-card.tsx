import type { DashboardData } from "@/lib/dashboard/types";
import { buildBestEfforts } from "@/lib/charts/best-efforts";
import { ChartCard, ChartEmpty } from "./chart-card";
import { EffortRows } from "./effort-rows";

/** The card's "?" explanation. */
const HELP =
  "Your best runs at a few marks: the fastest mile, 2 miles and 5K anywhere inside a run (so the fast middle of a longer run counts), your longest run, and your longest stretch of running without a walk break. Each shows your all-time best, your best in the selected range, and a step line of every time the record fell. Click a row or a step to open that run.";

/** Personal bests: all-time, in the range, and how each record fell. */
export function BestEffortsCard({ data }: { data: DashboardData }) {
  const efforts = buildBestEfforts(data);
  const title = "Best efforts";
  const subtitle = "Your records, and your best in this range";
  if (!efforts.length) {
    return (
      <ChartCard help={HELP} title={title} subtitle={subtitle}>
        <ChartEmpty>no runs with detail yet</ChartEmpty>
      </ChartCard>
    );
  }
  return (
    <ChartCard help={HELP} title={title} subtitle={subtitle}>
      <EffortRows efforts={efforts} today={data.today} />
    </ChartCard>
  );
}
