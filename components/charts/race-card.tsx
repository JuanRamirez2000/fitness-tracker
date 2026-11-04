import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRacePredictions, fmtRaceChange, fmtRaceTime } from "@/lib/charts/fitness";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot } from "./parts";

const WIDTH = 400;
const PANEL_HEIGHT = 40;

/** Garmin's predicted 5K, 10K and half marathon: today's time, the change over the range, and a line (faster is up). */
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
  const from = first > data.dateRange.from ? first : data.dateRange.from;
  const fromMs = dayStartUtcMs(from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [2, WIDTH - 2] });

  return (
    <ChartCard title={title} subtitle="Garmin's predicted finish times · faster is up" note={from !== data.dateRange.from ? `predictions start ${fmtDate(from)}` : undefined}>
      <div className="flex flex-col gap-3">
        {races.map((r) => {
          const values = r.points.map((p) => p.value);
          const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 5);
          // Faster (fewer seconds) is up.
          const y = scaleLinear<number>({ domain: [Math.min(...values) - pad, Math.max(...values) + pad], range: [4, PANEL_HEIGHT - 4] });
          const change = r.change === null ? "one prediction in range" : fmtRaceChange(r.change);
          return (
            <div key={r.label} className="grid grid-cols-[112px_1fr] items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-2">{r.label}</span>
                <span className="font-mono text-[18px] leading-tight text-ink">{fmtRaceTime(r.latest)}</span>
                <span className={`font-mono text-[10px] ${r.change !== null && r.change < 0 ? "text-good" : "text-muted-2"}`}>{change}</span>
              </div>
              <Plot width={WIDTH} height={PANEL_HEIGHT} label={`${r.label} prediction ${fmtRaceTime(r.latest)}, ${change}`}>
                <LinePath
                  data={r.points}
                  x={(p) => x(dayStartUtcMs(p.date))}
                  y={(p) => y(p.value)}
                  className="fill-none stroke-domain-rec"
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
              </Plot>
            </div>
          );
        })}
        <div className="pl-[124px]">
          <AxisRow start={fmtDate(from)} end={fmtDate(data.dateRange.to)} />
        </div>
      </div>
    </ChartCard>
  );
}
