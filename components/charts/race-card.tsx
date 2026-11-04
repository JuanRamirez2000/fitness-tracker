import type { DashboardData } from "@/lib/dashboard/types";
import { buildRacePredictions, fmtRaceChange, fmtRaceTime } from "@/lib/charts/fitness";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";

/** Garmin's predicted 5K, 10K and half marathon as a compact table: today's time and the change over the range. */
export function RaceCard({ data }: { data: DashboardData }) {
  const races = buildRacePredictions(data);
  const title = "Race predictions";
  if (races.length === 0) {
    return (
      <ChartCard title={title} subtitle="Garmin's predicted finish times">
        <ChartEmpty>{data.training.length ? "no data in range" : "no predictions yet"}</ChartEmpty>
      </ChartCard>
    );
  }

  const first = races[0].points[0].date;
  const since = first > data.dateRange.from ? first : data.dateRange.from;
  return (
    <ChartCard title={title} subtitle={`Garmin's predicted finish times, change since ${fmtDate(since)}`}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-divider font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2">
            <th className="py-2 pr-3 font-normal">Distance</th>
            <th className="py-2 pr-3 text-right font-normal">Today</th>
            <th className="py-2 text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {races.map((r) => (
            <tr key={r.label} className="border-b border-divider/60 last:border-0">
              <td className="py-2.5 pr-3 text-[12.5px]">{r.label}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-[15px] text-ink">{fmtRaceTime(r.latest)}</td>
              <td className={`py-2.5 text-right font-mono text-[11.5px] ${r.change !== null && r.change < 0 ? "text-good" : "text-muted-2"}`}>
                {r.change === null ? "–" : fmtRaceChange(r.change)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  );
}
