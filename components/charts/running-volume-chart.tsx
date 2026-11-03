import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildRunningVolume } from "@/lib/charts/running-volume";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const PLOT_HEIGHT = 130;

/** Miles per day, or per week past the steps chart's own aggregate threshold. */
export function RunningVolumeChart({ data }: { data: DashboardData }) {
  const volume = buildRunningVolume(data);

  if (volume.runCount === 0) {
    return (
      <ChartCard title="Running volume" caption={<span>no runs in range</span>}>
        <p className="py-8 text-center text-[12px] text-muted-2">No runs in this range yet.</p>
      </ChartCard>
    );
  }

  const xScale = scaleBand<string>({ domain: volume.bars.map((b) => b.label), range: [0, WIDTH], padding: 0.15 });
  const yMax = Math.max(volume.aggregated ? 10 : 4, ...volume.bars.map((b) => b.miles));
  const y = scaleLinear<number>({ domain: [0, yMax], range: [PLOT_HEIGHT, 0] });

  return (
    <ChartCard title="Running volume" caption={<span>{volume.aggregated ? "miles per week" : "miles per day"}</span>}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
        <line x1={0} x2={WIDTH} y1={PLOT_HEIGHT} y2={PLOT_HEIGHT} className="stroke-border-strong" strokeWidth={1} />
        {volume.bars
          .filter((b) => b.miles > 0)
          .map((b) => {
            const height = Math.max(PLOT_HEIGHT - y(b.miles), 1.5);
            return (
              <Bar
                key={b.label}
                x={xScale(b.label) ?? 0}
                y={PLOT_HEIGHT - height}
                width={xScale.bandwidth()}
                height={height}
                rx={1.5}
                className="fill-accent"
              />
            );
          })}
      </svg>
      <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
        <span>{volume.bars[0]?.label}</span>
        <span>
          {volume.totalMiles.toFixed(1)} mi · {volume.runCount} run{volume.runCount === 1 ? "" : "s"}
        </span>
        <span>{volume.bars.at(-1)?.label}</span>
      </div>
    </ChartCard>
  );
}
