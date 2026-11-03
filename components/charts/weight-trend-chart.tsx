import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeightTrend, type WeightTrendChartData, type WeightTrendPoint } from "@/lib/charts/weight-trend";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import type { ShotStarState } from "@/lib/shots/match";
import { ChartCard } from "./chart-card";

const WIDTH = 900;
const HEIGHT = 200;
const MARGIN = { top: 8, right: 8, bottom: 34, left: 34 };
const COMPACT_WIDTH = 300;
const COMPACT_HEIGHT = 90;

const STAR_GLYPH: Record<ShotStarState, string> = { taken: "★", scheduled: "☆", missed: "☆" };
// Matches the heatmap's own star conventions (components/heatmap/heatmap-cell.tsx): taken is
// fully opaque, scheduled and missed are hollow, missed reads more muted than upcoming.
const STAR_OPACITY: Record<ShotStarState, number> = { taken: 1, scheduled: 0.85, missed: 0.55 };

/**
 * The flagship chart (frame 2A "Charts"): raw daily dots, a 7-day-average line and area, a
 * goal line, a real pace line (from the account's own goal_pace_lb_per_week — the design
 * mockup hardcodes 1 lb/week, which this deliberately does not reproduce), a program-start
 * marker, and a row of shot stars. No brush/zoom: the page's own RangeControl already changes
 * the window, and the design's brush was never wired to any interaction of its own.
 */
export function WeightTrendChart({ data }: { data: DashboardData }) {
  const chart = buildWeightTrend(data);

  if (!chart) {
    return (
      <ChartCard title="Weight trend" caption={<span>{data.dateRange.from} – {data.dateRange.to}</span>}>
        <p className="py-10 text-center text-[12px] text-muted-2">No weigh-ins in this range yet.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Weight trend"
      caption={
        <>
          <Legend swatch="●" className="text-muted-3" label="raw" />
          <Legend swatch="—" className="text-accent" label="7-day avg" />
          {chart.paceLine && <Legend swatch="┄" className="text-muted-2" label="pace" />}
          {goalInDomain(chart) && <Legend swatch="┄" className="text-good" label={`goal ${chart.goal}`} />}
          <Legend swatch="★" className="text-accent" label="shot" />
          {chart.runDays.length > 0 && <Legend swatch="▎" className="text-good" label="run" />}
        </>
      }
    >
      <WeightTrendPlot chart={chart} />
    </ChartCard>
  );
}

/**
 * The chart's SVG on its own, for any prebuilt window (the main card above, or the fixed
 * month / 6-month / year panels in TrendWindowsRow). `compact` (frame 2B's reduced card)
 * drops the gridlines, dots, stars and labels down to the area, avg line and goal line, in a
 * narrower viewBox so it stays legible in a third-width card.
 */
export function WeightTrendPlot({ chart, compact = false }: { chart: WeightTrendChartData; compact?: boolean }) {
  const width = compact ? COMPACT_WIDTH : WIDTH;
  const height = compact ? COMPACT_HEIGHT : HEIGHT;
  const margin = compact ? { top: 4, right: 0, bottom: 0, left: 0 } : MARGIN;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const fromMs = dayStartUtcMs(chart.fromLabel);
  const toMs = Math.max(dayStartUtcMs(chart.toLabel), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [0, plotWidth] });
  const y = scaleLinear<number>({ domain: chart.yDomain, range: [plotHeight, 0] });
  const yTicks = [0, 1, 2, 3].map((i) => chart.yDomain[0] + (i / 3) * (chart.yDomain[1] - chart.yDomain[0]));
  const showGoal = goalInDomain(chart);
  const xOf = (p: WeightTrendPoint) => x(p.dateMs);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <Group left={margin.left} top={margin.top}>
        {!compact &&
          yTicks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotWidth} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} />
              <text x={-8} y={y(t) + 3} textAnchor="end" className="fill-muted-2 font-mono text-[9px]">
                {t.toFixed(0)}
              </text>
            </g>
          ))}

        {!compact && chart.programStartMs !== null && (
          <line
            x1={x(chart.programStartMs)}
            x2={x(chart.programStartMs)}
            y1={0}
            y2={plotHeight}
            className="stroke-border-strong"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {showGoal && (
          <line
            x1={0}
            x2={plotWidth}
            y1={y(chart.goal!)}
            y2={y(chart.goal!)}
            className="stroke-good"
            strokeWidth={1.2}
            strokeDasharray="5 4"
            strokeOpacity={0.75}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {!compact && chart.paceLine && (
          <line
            x1={x(chart.paceLine.start.dateMs)}
            y1={y(chart.paceLine.start.weight)}
            x2={x(chart.paceLine.end.dateMs)}
            y2={y(chart.paceLine.end.weight)}
            className="stroke-muted-2"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
        )}

        <AreaClosed data={chart.points} x={xOf} y={(p) => y(p.avg7)} yScale={y} className="fill-accent/7" />

        {!compact &&
          chart.points.map((p) => <circle key={p.local_date} cx={xOf(p)} cy={y(p.weight)} r={1.7} className="fill-muted-3" />)}

        <LinePath
          data={chart.points}
          x={xOf}
          y={(p) => y(p.avg7)}
          className="stroke-accent"
          strokeWidth={compact ? 1.8 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {!compact &&
          chart.runDays.map((ms) => (
            <line
              key={ms}
              x1={x(ms)}
              x2={x(ms)}
              y1={plotHeight - 7}
              y2={plotHeight}
              className="stroke-good"
              strokeWidth={1.5}
              strokeOpacity={0.8}
              strokeLinecap="round"
            />
          ))}

        {!compact &&
          chart.stars.map((s) => (
            <text
              key={s.dateMs}
              x={x(s.dateMs)}
              y={plotHeight + 16}
              textAnchor="middle"
              opacity={STAR_OPACITY[s.state]}
              className={`text-[11px] ${s.state === "missed" ? "fill-muted-2" : "fill-accent"}`}
            >
              {STAR_GLYPH[s.state]}
            </text>
          ))}

        {!compact && (
          <>
            <text x={0} y={plotHeight + 28} className="fill-muted-2 font-mono text-[9.5px]">
              {chart.fromLabel}
            </text>
            <text x={plotWidth} y={plotHeight + 28} textAnchor="end" className="fill-muted-2 font-mono text-[9.5px]">
              {chart.toLabel}
            </text>
          </>
        )}
      </Group>
    </svg>
  );
}

function goalInDomain(chart: WeightTrendChartData): boolean {
  return chart.goal !== null && chart.goal >= chart.yDomain[0] && chart.goal <= chart.yDomain[1];
}

function Legend({ swatch, className, label }: { swatch: string; className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={className}>{swatch}</span>
      {label}
    </span>
  );
}
