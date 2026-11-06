import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRunEfficiency, type RunEfficiencyPoint } from "@/lib/charts/run-efficiency";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { EFFICIENCY_REF_HR, fmtPace } from "@/lib/running/runs";
import { fmtPointTitle } from "@/lib/dates/format";
import { ChartCard } from "./chart-card";
import { ChartHover, type HoverPoint } from "./chart-hover";

/** The card's "?" explanation. */
const HELP = "Each easy run's pace adjusted to what it would be at 130 bpm, so runs at different heart rates compare fairly; the line is the running median. A line that climbs means the same heart rate is buying a faster pace: your aerobic fitness improving. Click a dot to open the run.";

const WIDTH = 400;
const PLOT_HEIGHT = 130;
const MARGIN_LEFT = 30;

/**
 * Each easy run's pace scaled to 130 bpm (dots) and its rolling median (line), faster at the
 * top. A line that climbs means the same heart rate is buying a faster pace.
 */
export function RunEfficiencyChart({ data }: { data: DashboardData }) {
  const chart = buildRunEfficiency(data);
  const title = "Easy-run efficiency";

  if (!chart) {
    return (
      <ChartCard help={HELP} title={title} caption={<span>pace @ {EFFICIENCY_REF_HR} bpm</span>}>
        <p className="py-8 text-center text-[12px] text-muted-2">No easy runs with heart rate in this range.</p>
      </ChartCard>
    );
  }

  const plotWidth = WIDTH - MARGIN_LEFT;
  const fromMs = dayStartUtcMs(data.dateRange.from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [0, plotWidth] });
  const y = scaleLinear<number>({ domain: chart.paceDomain, range: [PLOT_HEIGHT, 0] });
  const ticks = [0, 1, 2].map((i) => chart.paceDomain[0] + (i / 2) * (chart.paceDomain[1] - chart.paceDomain[0]));
  const xOf = (p: RunEfficiencyPoint) => x(p.dateMs);
  const change = chart.changeSec;
  const points: HoverPoint[] = chart.points.map((p) => ({
    at: (MARGIN_LEFT + xOf(p)) / WIDTH,
    title: `${fmtPointTitle(p.local_date)} · ${p.name}`,
    rows: [
      { label: `Pace @ ${EFFICIENCY_REF_HR}`, value: `${fmtPace(p.pace)} /mi`, swatch: { shape: "dot", className: "bg-muted-2" } },
      { label: "Trend", value: `${fmtPace(p.trend)} /mi`, swatch: { shape: "line", className: "bg-accent" } },
      { label: "Avg HR", value: `${p.avgHr} bpm`, muted: true },
    ],
    marks: [{ y: y(p.pace) / PLOT_HEIGHT, className: "bg-ink" }],
    activityId: p.id,
  }));

  return (
    <ChartCard help={HELP} title={title} caption={<span>pace @ {EFFICIENCY_REF_HR} bpm · faster is up</span>}>
      <ChartHover points={points} label="easy runs">
        <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="block overflow-visible">
          <g transform={`translate(${MARGIN_LEFT},0)`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotWidth} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} />
                <text x={-6} y={y(t) + 3} textAnchor="end" className="fill-muted-2 font-mono text-[9px]">
                  {fmtPace(t)}
                </text>
              </g>
            ))}
            {chart.points.map((p) => (
              <circle key={`${p.local_date}-${p.pace}`} cx={xOf(p)} cy={y(p.pace)} r={3} className="fill-muted-2" fillOpacity={0.7} />
            ))}
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
        <span>{data.dateRange.from}</span>
        <span className={change !== null && change < 0 ? "text-good" : undefined}>
          {change === null ? `${chart.points.length} easy run` : `${change <= 0 ? "−" : "+"}${fmtPace(Math.abs(change))}/mi over ${chart.points.length} runs`}
        </span>
        <span>{data.dateRange.to}</span>
      </div>
    </ChartCard>
  );
}
