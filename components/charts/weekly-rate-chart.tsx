import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildWeeklyRate } from "@/lib/charts/weekly-rate";
import { signed } from "@/lib/kpis/format";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const PLOT_HEIGHT = 92;

/** Diverging weekly bars: green below the zero line for a losing week, red above for a
 * gaining one — matches the heatmap and KPI cards' own good/bad convention. */
export function WeeklyRateChart({ data }: { data: DashboardData }) {
  const rates = buildWeeklyRate(data);

  if (rates.length === 0) {
    return (
      <ChartCard title="Weekly rate" caption={<span>lb per week</span>}>
        <p className="py-8 text-center text-[12px] text-muted-2">Not enough weeks logged yet.</p>
      </ChartCard>
    );
  }

  const xScale = scaleBand<string>({ domain: rates.map((r) => r.weekStart), range: [0, WIDTH], padding: 0.15 });
  const maxAbs = Math.max(1, ...rates.map((r) => Math.abs(r.rate)));
  const y = scaleLinear<number>({ domain: [-maxAbs, maxAbs], range: [PLOT_HEIGHT, 0] });
  const zeroY = y(0);
  const avg = rates.reduce((a, b) => a + b.rate, 0) / rates.length;

  return (
    <ChartCard title="Weekly rate" caption={<span>lb per week</span>}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
        <line x1={0} x2={WIDTH} y1={zeroY} y2={zeroY} className="stroke-border-strong" strokeWidth={1} />
        {rates.map((r) => {
          const barY = r.rate < 0 ? y(r.rate) : zeroY;
          const barHeight = Math.max(Math.abs(y(r.rate) - zeroY), 1.5);
          return (
            <Bar
              key={r.weekStart}
              x={xScale(r.weekStart) ?? 0}
              y={barY}
              width={xScale.bandwidth()}
              height={barHeight}
              rx={1.5}
              className={r.rate < 0 ? "fill-good" : "fill-bad"}
            />
          );
        })}
      </svg>
      <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
        <span>{rates[0].weekStart}</span>
        <span>avg {signed(avg, 2)} lb/wk</span>
        <span>{rates.at(-1)!.weekStart}</span>
      </div>
    </ChartCard>
  );
}
