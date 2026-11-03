import type { DashboardData } from "@/lib/dashboard/types";
import { buildTrendWindows, type TrendWindowKey } from "@/lib/charts/trend-windows";
import type { LocalDate } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard } from "./chart-card";
import { WeightTrendPlot } from "./weight-trend-chart";

const TITLES: Record<TrendWindowKey, string> = { month: "Month", "6m": "6 months", year: "Year" };

/** The last month, 6 months and year of the weight trend side by side, whatever the page's
 * own range is, so short- and long-run direction read at a glance. */
export function TrendWindowsRow({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-3.5 md:grid-cols-3">
      {buildTrendWindows(data).map(({ key, chart, changeLb }) => (
        <ChartCard
          key={key}
          title={TITLES[key]}
          caption={
            chart && (
              <>
                <span>{fmtSpan(chart.fromLabel, chart.toLabel)}</span>
                {changeLb !== null && (
                  <span className={changeLb < 0 ? "text-good" : changeLb > 0 ? "text-bad" : undefined}>
                    {fmtChange(changeLb)}
                  </span>
                )}
              </>
            )
          }
        >
          {chart ? (
            <WeightTrendPlot chart={chart} compact />
          ) : (
            <p className="py-6 text-center text-[12px] text-muted-2">No weigh-ins yet.</p>
          )}
        </ChartCard>
      ))}
    </div>
  );
}

/** fmtDate is year-agnostic, so a span crossing a year boundary (the Year panel always does)
 * names the start's year too: "Nov 2 '25 – Nov 2" rather than an ambiguous "Nov 2 – Nov 2". */
function fmtSpan(from: LocalDate, to: LocalDate): string {
  const start = from.slice(0, 4) === to.slice(0, 4) ? fmtDate(from) : `${fmtDate(from)} '${from.slice(2, 4)}`;
  return `${start} – ${fmtDate(to)}`;
}

function fmtChange(lb: number): string {
  const sign = lb > 0 ? "+" : lb < 0 ? "−" : "±";
  return `${sign}${Math.abs(lb).toFixed(1)} lb`;
}
