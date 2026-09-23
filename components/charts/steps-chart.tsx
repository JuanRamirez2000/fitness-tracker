import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildSteps } from "@/lib/charts/steps";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const PLOT_HEIGHT = 130;
const STEP_AXIS_MAX = 16000;

function kLabel(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

/** Daily bars, or a weekly average past lib/charts/steps.ts's aggregate threshold, against a
 * dashed goal line at the account's real steps_goal (not the design's hardcoded 10k). */
export function StepsChart({ data }: { data: DashboardData }) {
  const steps = buildSteps(data);

  if (data.range.steps.length === 0) {
    return (
      <ChartCard title="Steps" caption={<span>no data in range</span>}>
        <p className="py-8 text-center text-[12px] text-muted-2">Nothing logged in this range yet.</p>
      </ChartCard>
    );
  }

  const xScale = scaleBand<string>({ domain: steps.bars.map((b) => b.label), range: [0, WIDTH], padding: 0.15 });
  const yMax = Math.max(STEP_AXIS_MAX, steps.goal, ...steps.bars.map((b) => b.steps));
  const y = scaleLinear<number>({ domain: [0, yMax], range: [PLOT_HEIGHT, 0] });
  const goalY = y(steps.goal);

  return (
    <ChartCard title="Steps" caption={<span>{steps.aggregated ? "weekly average" : "daily"}</span>}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT + 14}`} preserveAspectRatio="none" className="overflow-visible">
        <line
          x1={0}
          x2={WIDTH}
          y1={goalY}
          y2={goalY}
          className="stroke-accent"
          strokeWidth={1}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
        <text x={WIDTH} y={goalY - 4} textAnchor="end" className="fill-muted-2 font-mono text-[9.5px]">
          {kLabel(steps.goal)}
        </text>
        {steps.bars.map((b) => {
          const height = Math.max(PLOT_HEIGHT - y(b.steps), 1.5);
          return (
            <Bar
              key={b.label}
              x={xScale(b.label) ?? 0}
              y={PLOT_HEIGHT - height}
              width={xScale.bandwidth()}
              height={height}
              rx={1.5}
              className={b.hitGoal ? "fill-accent" : "fill-muted-3"}
            />
          );
        })}
      </svg>
      <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
        <span>{steps.bars[0]?.label}</span>
        <span>{steps.hitCount === 1 ? "1 day" : `${steps.hitCount} days`} over {kLabel(steps.goal)}</span>
        <span>{steps.bars.at(-1)?.label}</span>
      </div>
    </ChartCard>
  );
}
