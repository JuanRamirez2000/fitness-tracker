import { scaleBand, scaleLinear } from "@visx/scale";
import type { DashboardData } from "@/lib/dashboard/types";
import { EASY_SHARE_AIM, buildZoneChart } from "@/lib/charts/training";
import { fmtDate } from "@/lib/dates/format";
import { ChartCard, ChartEmpty } from "./chart-card";
import { AxisRow, Plot, Stat, StatRow, Swatch } from "./parts";

const WIDTH = 520;
const HEIGHT = 140;
const Y_LABEL_W = 30;
const ZONE_FILL = ["fill-z1", "fill-z2", "fill-z3", "fill-z4", "fill-z5"];
const ZONE_BG = ["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5"];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Minutes in each HR zone across runs, stacked Z1 at the bottom, per day or per week. */
export function ZonesChart({ data }: { data: DashboardData }) {
  const chart = buildZoneChart(data);
  const title = "Time in HR zones";
  if (!chart) {
    return (
      <ChartCard title={title} subtitle="Runs, by heart rate zone">
        <ChartEmpty>no runs with heart rate in range</ChartEmpty>
      </ChartCard>
    );
  }

  const unit = chart.weekly ? "per week" : "per day";
  const x = scaleBand<string>({ domain: chart.bars.map((b) => b.label), range: [0, WIDTH - Y_LABEL_W], padding: 0.25 });
  const maxMin = Math.max(30, ...chart.bars.map((b) => b.minutes.reduce((s, v) => s + v, 0)));
  const y = scaleLinear<number>({ domain: [0, maxMin], range: [HEIGHT, 4] }).nice();
  const ticks = y.ticks(3);
  const legend = [0, 1, 2, 3, 4].map((i) => ({
    label: `Z${i + 1}${chart.bounds ? ` ${chart.bounds[i][0]}–${chart.bounds[i][1]}` : ""}`,
    swatch: Swatch.square(ZONE_BG[i]),
  }));

  return (
    <ChartCard title={title} subtitle={`Runs, minutes ${unit}, Z1 at the bottom${chart.bounds ? " · bpm from your Garmin zones" : ""}`} legend={legend}>
      <StatRow>
        <Stat
          label="Easy share (Z1–2)"
          value={pct(chart.easyShare)}
          note={`${chart.easyShareLast7 !== null ? `last 7 days ${pct(chart.easyShareLast7)} · ` : ""}aim ${pct(EASY_SHARE_AIM)}`}
        />
        <Stat label="Total" value={Math.round(chart.totalMinutes)} unit="min" />
      </StatRow>
      <Plot
        width={WIDTH}
        height={HEIGHT}
        label={`Time in heart rate zones ${unit}: ${pct(chart.easyShare)} easy over the range, ${Math.round(chart.totalMinutes)} minutes in all`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={Y_LABEL_W} x2={WIDTH} y1={y(t)} y2={y(t)} className="stroke-divider" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={0} y={y(t) + 3} className="fill-muted-2 font-mono text-[9px]">
              {t}m
            </text>
          </g>
        ))}
        {chart.bars.map((b) => {
          let top = HEIGHT;
          return (
            <g key={b.label}>
              {b.minutes.map((m, i) => {
                const h = HEIGHT - y(m);
                if (h <= 0.2) return null;
                top -= h;
                return <rect key={i} x={Y_LABEL_W + (x(b.label) ?? 0)} y={top} width={x.bandwidth()} height={Math.max(h - 1, 0.5)} className={ZONE_FILL[i]} />;
              })}
            </g>
          );
        })}
      </Plot>
      <AxisRow start={fmtDate(chart.bars[0].label)} end={fmtDate(chart.bars.at(-1)!.label)} />
    </ChartCard>
  );
}
