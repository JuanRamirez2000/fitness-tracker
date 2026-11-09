import { useId } from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeightTrend, type WeightTrendChartData, type WeightTrendPoint } from "@/lib/charts/weight-trend";
import { dayStartUtcMs } from "@/lib/dates/calendar";
import type { ShotStarState } from "@/lib/shots/match";
import { fmtPointTitle } from "@/lib/dates/format";
import { ChartCard, type ChartLegendItem } from "./chart-card";
import { ChartHover, type HoverPoint } from "./chart-hover";
import { Swatch } from "./parts";

/** The card's "?" explanation. */
const HELP = "Dots are each weigh-in; the line is the 7-day average, which smooths out day-to-day water swings and is the number to watch. The dashed line is where your planned pace would put you; stars mark shots and ticks mark days you rode or ran.";

const WIDTH = 900;
const HEIGHT = 200;
const MARGIN = { top: 8, right: 8, bottom: 34, left: 34 };

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
      <ChartCard help={HELP} title="Weight trend" caption={<span>{data.dateRange.from} – {data.dateRange.to}</span>}>
        <p className="py-10 text-center text-[12px] text-muted-2">No weigh-ins in this range yet.</p>
      </ChartCard>
    );
  }

  const glyph = (text: string, className: string) => <span className={`text-[11px] leading-none ${className}`}>{text}</span>;
  const legend: ChartLegendItem[] = [
    { label: "daily", swatch: Swatch.dot("bg-muted-3") },
    { label: "7-day avg", swatch: Swatch.line("bg-accent") },
    ...(chart.paceLine ? [{ label: "plan pace", swatch: Swatch.dashed("border-muted-2") }] : []),
    ...(goalInDomain(chart) ? [{ label: `goal ${chart.goal}`, swatch: Swatch.dashed("border-good") }] : []),
    ...(chart.workoutDays.length > 0 ? [{ label: "ride or run", swatch: glyph("▎", "text-good") }] : []),
    { label: "Zepbound shot", swatch: glyph("★", "text-accent") },
    ...(chart.programStartMs !== null ? [{ label: "program start", swatch: Swatch.dashed("border-border-strong") }] : []),
  ];

  return (
    <ChartCard help={HELP}
      title="Weight trend"
      legend={legend}
      note={
        chart.goalBelowAvg !== null && chart.goal !== null
          ? `goal ${chart.goal} lb is off this scale, ${Math.abs(chart.goalBelowAvg).toFixed(1)} lb ${chart.goalBelowAvg >= 0 ? "below" : "above"} the latest 7-day average`
          : undefined
      }
    >
      <WeightTrendPlot chart={chart} />
    </ChartCard>
  );
}

/** The chart's SVG on its own, apart from the card chrome and legend around it. */
function WeightTrendPlot({ chart }: { chart: WeightTrendChartData }) {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const fromMs = dayStartUtcMs(chart.fromLabel);
  const toMs = Math.max(dayStartUtcMs(chart.toLabel), fromMs + 1);
  const x = scaleLinear<number>({ domain: [fromMs, toMs], range: [0, plotWidth] });
  const y = scaleLinear<number>({ domain: chart.yDomain, range: [plotHeight, 0] });
  const yTicks = [0, 1, 2, 3].map((i) => chart.yDomain[0] + (i / 3) * (chart.yDomain[1] - chart.yDomain[0]));
  const showGoal = goalInDomain(chart);
  const xOf = (p: WeightTrendPoint) => x(p.dateMs);
  // The plan pace line runs from the start weight, usually far above a y-axis fitted to the
  // visible data: clip it to the plot so it doesn't spill over the cards above.
  const clipId = `plot-${useId().replace(/:/g, "")}`;

  // Hover: each weigh-in day's reading, its 7-day average, where the plan put you that day, and
  // whether it was a shot day or a ride or run day.
  const starBy = new Map(chart.stars.map((s) => [s.dateMs, s.state]));
  const workoutDays = new Map(chart.workoutDays.map((d) => [d.dateMs, d.label]));
  const pace = chart.paceLine;
  const planAt = (ms: number) =>
    pace && ms >= pace.start.dateMs && ms <= pace.end.dateMs
      ? pace.start.weight + ((ms - pace.start.dateMs) / (pace.end.dateMs - pace.start.dateMs || 1)) * (pace.end.weight - pace.start.weight)
      : null;
  const points: HoverPoint[] = chart.points.map((p) => {
    const plan = planAt(p.dateMs);
    const star = starBy.get(p.dateMs);
    return {
      at: (MARGIN.left + xOf(p)) / WIDTH,
      title: fmtPointTitle(p.local_date),
      rows: [
        { label: "Weigh-in", value: `${p.weight.toFixed(1)} lb`, swatch: { shape: "dot", className: "bg-muted-3" } },
        { label: "7-day avg", value: `${p.avg7.toFixed(1)} lb`, swatch: { shape: "line", className: "bg-accent" } },
        ...(plan !== null
          ? [{ label: "Plan pace", value: `${plan.toFixed(1)} lb`, swatch: { shape: "dashed" as const, className: "border-muted-2" }, muted: true }]
          : []),
        ...(chart.goal !== null ? [{ label: "Goal", value: `${chart.goal} lb`, swatch: { shape: "dashed" as const, className: "border-good" }, muted: true }] : []),
        ...(star ? [{ label: "Shot", value: star === "taken" ? "taken" : star }] : []),
        ...(workoutDays.has(p.dateMs) ? [{ label: "Trained", value: workoutDays.get(p.dateMs)! }] : []),
      ],
      marks: [
        { y: (MARGIN.top + y(p.weight)) / HEIGHT, className: "bg-muted-2" },
        { y: (MARGIN.top + y(p.avg7)) / HEIGHT, className: "bg-accent" },
      ],
    };
  });

  return (
    <ChartHover points={points} label="weigh-ins">
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block overflow-visible">
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={plotWidth} height={plotHeight} />
        </clipPath>
      </defs>
      <Group left={MARGIN.left} top={MARGIN.top}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={0} x2={plotWidth} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} />
            <text x={-8} y={y(t) + 3} textAnchor="end" className="fill-muted-2 font-mono text-[9px]">
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        {chart.programStartMs !== null && (
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
        {chart.programStartMs !== null && (
          <text x={x(chart.programStartMs) + 4} y={10} className="fill-muted-2 font-mono text-[9px]">
            program start{chart.startWeight !== null ? ` · ${Math.round(chart.startWeight)}` : ""}
          </text>
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

        {chart.paceLine && (
          <line
            x1={x(chart.paceLine.start.dateMs)}
            y1={y(chart.paceLine.start.weight)}
            x2={x(chart.paceLine.end.dateMs)}
            y2={y(chart.paceLine.end.weight)}
            className="stroke-muted-2"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            clipPath={`url(#${clipId})`}
          />
        )}

        <AreaClosed data={chart.points} x={xOf} y={(p) => y(p.avg7)} yScale={y} className="fill-accent/7" />

        {chart.points.map((p) => (
          <circle key={p.local_date} cx={xOf(p)} cy={y(p.weight)} r={1.7} className="fill-muted-3" />
        ))}

        <LinePath
          data={chart.points}
          x={xOf}
          y={(p) => y(p.avg7)}
          className="stroke-accent"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {chart.workoutDays.map(({ dateMs: ms }) => (
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

        {chart.stars.map((s) => (
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

        <text x={0} y={plotHeight + 28} className="fill-muted-2 font-mono text-[9.5px]">
          {chart.fromLabel}
        </text>
        <text x={plotWidth} y={plotHeight + 28} textAnchor="end" className="fill-muted-2 font-mono text-[9.5px]">
          {chart.toLabel}
        </text>
      </Group>
    </svg>
    </ChartHover>
  );
}

function goalInDomain(chart: WeightTrendChartData): boolean {
  return chart.goal !== null && chart.goal >= chart.yDomain[0] && chart.goal <= chart.yDomain[1];
}


