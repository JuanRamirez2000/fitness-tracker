import { curveStepAfter } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildFastestMile, type FastestMilePoint } from "@/lib/charts/fastest-mile";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import { fmtDate } from "@/lib/dates/format";
import { fmtPace } from "@/lib/running/runs";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const PLOT_HEIGHT = 130;
const MARGIN_LEFT = 30;

/** Each run's fastest mile split (dots) under the all-time best so far (step line): a dot on
 * the line is a new personal best. Faster is up. */
export function FastestMileChart({ data }: { data: DashboardData }) {
  const chart = buildFastestMile(data);

  if (!chart) {
    return (
      <ChartCard title="Fastest mile" caption={<span>per run</span>}>
        <p className="py-8 text-center text-[12px] text-muted-2">No mile splits in this range.</p>
      </ChartCard>
    );
  }

  const plotWidth = WIDTH - MARGIN_LEFT;
  const fromMs = dayStartUtcMs(data.dateRange.from);
  const toMs = Math.max(dayStartUtcMs(data.dateRange.to), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [0, plotWidth] });
  const y = scaleLinear<number>({ domain: chart.domain, range: [PLOT_HEIGHT, 0] });
  const ticks = [0, 1, 2].map((i) => chart.domain[0] + (i / 2) * (chart.domain[1] - chart.domain[0]));
  const xOf = (p: FastestMilePoint) => x(p.dateMs);
  // Carry the best line to the range's right edge, so a PR's level reads across.
  const bestLine = [...chart.points, { ...chart.points.at(-1)!, dateMs: toMs }];

  return (
    <ChartCard title="Fastest mile" caption={<span>per run · best line · faster is up</span>}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
        <g transform={`translate(${MARGIN_LEFT},0)`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotWidth} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} />
              <text x={-6} y={y(t) + 3} textAnchor="end" className="fill-muted-2 font-mono text-[9px]">
                {fmtPace(t)}
              </text>
            </g>
          ))}
          <LinePath
            data={bestLine}
            x={xOf}
            y={(p) => y(p.best)}
            curve={curveStepAfter}
            className="stroke-good"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          {chart.points.map((p) => (
            <circle
              key={`${p.local_date}-${p.seconds}`}
              cx={xOf(p)}
              cy={y(p.seconds)}
              r={3}
              className={p.seconds === p.best ? "fill-good" : "fill-accent"}
            />
          ))}
        </g>
      </svg>
      <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
        <span>{data.dateRange.from}</span>
        <span>
          best {fmtPace(chart.allTimeBest.seconds)} · {fmtDate(chart.allTimeBest.local_date)}
        </span>
        <span>{data.dateRange.to}</span>
      </div>
    </ChartCard>
  );
}
