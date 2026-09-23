import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import type { DashboardData } from "@/lib/dashboard/types";
import { buildProgress } from "@/lib/charts/progress";
import { signed } from "@/lib/kpis/format";
import { ChartCard } from "./chart-card";

const WIDTH = 400;
const HEIGHT = 76;

/** Progress since the very start (frame 2A): reuses progress-to-goal's own KPI percentage
 * for the big numbers and the bar, and adds a cumulative-change sparkline the KPI card
 * doesn't have room for. */
export function ProgressChart({ data }: { data: DashboardData }) {
  const progress = buildProgress(data);

  if (!progress) {
    return (
      <ChartCard title="Progress">
        <p className="py-6 text-center text-[12px] text-muted-2">No weigh-ins yet.</p>
      </ChartCard>
    );
  }

  const series = progress.series.map((p, i) => ({ ...p, i }));
  const x = scaleLinear<number>({ domain: [0, Math.max(series.length - 1, 1)], range: [0, WIDTH] });
  const values = series.map((p) => p.changeLb);
  const yMin = Math.min(0, ...values);
  const yMax = Math.max(0, ...values);
  const y = scaleLinear<number>({ domain: [yMin, yMax || 1], range: [HEIGHT - 6, 6] });

  return (
    <ChartCard title="Progress">
      <div className="flex items-end gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[26px] leading-none font-[450] tracking-[-0.015em]">{signed(progress.changedLb)}</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2">lb since start</span>
        </div>
        {progress.pct !== null && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[26px] leading-none font-[450] tracking-[-0.015em] text-accent">
              {Math.round(progress.pct * 100)}%
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-2">of the way to goal</span>
          </div>
        )}
      </div>

      {progress.goalLb !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((progress.pct ?? 0) * 100)}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[9.5px] text-muted-2">
            <span>{progress.startLb.toFixed(0)} start</span>
            <span>{progress.remainingLb!.toFixed(1)} lb to go</span>
            <span>{progress.goalLb} goal</span>
          </div>
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
        <AreaClosed data={series} x={(p) => x(p.i)} y={(p) => y(p.changeLb)} yScale={y} className="fill-accent/9" />
        <LinePath
          data={series}
          x={(p) => x(p.i)}
          y={(p) => y(p.changeLb)}
          className="stroke-accent"
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="font-mono text-[9.5px] text-muted-2">cumulative change, lb</span>
    </ChartCard>
  );
}
