import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRideEfficiency, type RideEfficiencyPoint } from "@/lib/charts/ride-efficiency";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate, fmtPointTitle } from "@/lib/dates/format";
import { ChartCard } from "./chart-card";
import { ChartHover, type HoverPoint } from "./chart-hover";

/** The card's "?" explanation. */
const HELP =
  "Each easy ride's average power divided by its average heart rate: how many watts each heartbeat buys. Power ignores hills, wind and a trainer's made-up speed, so indoor and outdoor rides compare fairly. The line is the running median; a line that climbs means more watts at the same heart rate, your aerobic fitness improving. Needs a power meter or smart trainer. Click a dot to open the ride.";

const WIDTH = 400;
const PLOT_HEIGHT = 130;
const MARGIN_LEFT = 30;

/** Easy rides' watts per heartbeat (dots: filled outdoors, hollow indoors) and their rolling median. */
export function RideEfficiencyChart({ data }: { data: DashboardData }) {
  const chart = buildRideEfficiency(data);
  const title = "Easy-ride efficiency";
  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} caption={<span>watts per heartbeat</span>}>
        <p className="py-8 text-center text-[12px] text-muted-2">No easy rides with power and heart rate in this range.</p>
      </ChartCard>
    );
  }

  const plotWidth = WIDTH - MARGIN_LEFT;
  const fromMs = dayStartUtcMs(data.dateRange.from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [0, plotWidth] });
  const y = scaleLinear<number>({ domain: chart.domain, range: [PLOT_HEIGHT, 0] });
  const ticks = [0, 1, 2].map((i) => chart.domain[0] + (i / 2) * (chart.domain[1] - chart.domain[0]));
  const xOf = (p: RideEfficiencyPoint) => x(p.dateMs);
  const change = chart.changePct;
  const points: HoverPoint[] = chart.points.map((p) => ({
    at: (MARGIN_LEFT + xOf(p)) / WIDTH,
    title: `${fmtPointTitle(p.local_date)} · ${p.name}`,
    rows: [
      { label: "Watts per beat", value: p.wattsPerBeat.toFixed(2), swatch: { shape: "dot", className: "bg-muted-2" } },
      { label: "Trend", value: p.trend.toFixed(2), swatch: { shape: "line", className: "bg-accent" } },
      { label: "Power · HR", value: `${p.watts} W · ${p.avgHr} bpm${p.indoor ? " · indoor" : ""}`, muted: true },
    ],
    marks: [{ y: y(p.wattsPerBeat) / PLOT_HEIGHT, className: "bg-ink" }],
    activityId: p.id,
  }));

  return (
    <ChartCard help={HELP} title={title} caption={<span>watts per heartbeat · higher is fitter</span>}>
      <ChartHover points={points} label="easy rides">
        <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="block overflow-visible">
          <g transform={`translate(${MARGIN_LEFT},0)`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotWidth} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} />
                <text x={-6} y={y(t) + 3} textAnchor="end" className="fill-muted-2 font-mono text-[9px]">
                  {t.toFixed(2)}
                </text>
              </g>
            ))}
            {chart.points.map((p) =>
              p.indoor ? (
                <circle key={p.id} cx={xOf(p)} cy={y(p.wattsPerBeat)} r={3} className="fill-none stroke-muted-2" strokeWidth={1.2} />
              ) : (
                <circle key={p.id} cx={xOf(p)} cy={y(p.wattsPerBeat)} r={3} className="fill-muted-2" fillOpacity={0.7} />
              ),
            )}
            <LinePath
              data={chart.points}
              x={xOf}
              y={(p) => y(p.trend)}
              className="stroke-accent"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
      </ChartHover>
      <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
        <span>{fmtDate(data.dateRange.from)}</span>
        <span className={change !== null && change > 0 ? "text-good" : undefined}>
          {change === null
            ? `1 easy ride · hollow = indoor`
            : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}% over ${chart.points.length} rides`}
        </span>
        <span>{fmtDate(data.dateRange.to)}</span>
      </div>
    </ChartCard>
  );
}
